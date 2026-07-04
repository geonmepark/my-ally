import { getSupabase } from './supabase'

// ── 시민판사 도메인 (judge_profiles / judge_applications / verdict_reviews) ──
// roomStore와 동일하게 service_role 경유 전용. 클라이언트 직접 접근 금지(RLS deny-all).

export const MAX_APPLICANTS = 10 // 방당 지원 상한
export const MAX_REJECTS = 3     // 이 횟수 누적 거부되면 해당 방에서 채택 불가(excluded)

export interface JudgeProfile {
  userId: string
  bio: string
  verdictCount: number
  reviewCount: number
  convincedCount: number
  tagCounts: Record<string, number>
}

export type ApplicationStatus = 'applied' | 'proposed' | 'selected' | 'excluded' | 'withdrawn'

export interface JudgeApplication {
  id: string
  roomCode: string
  judgeUserId: string
  pitch: string
  status: ApplicationStatus
  rejectCount: number
  createdAt: string
}

function toProfile(row: Record<string, unknown>): JudgeProfile {
  return {
    userId: row.user_id as string,
    bio: (row.bio as string) ?? '',
    verdictCount: (row.verdict_count as number) ?? 0,
    reviewCount: (row.review_count as number) ?? 0,
    convincedCount: (row.convinced_count as number) ?? 0,
    tagCounts: (row.tag_counts as Record<string, number>) ?? {},
  }
}

function toApplication(row: Record<string, unknown>): JudgeApplication {
  return {
    id: row.id as string,
    roomCode: row.room_code as string,
    judgeUserId: row.judge_user_id as string,
    pitch: row.pitch as string,
    status: row.status as ApplicationStatus,
    rejectCount: (row.reject_count as number) ?? 0,
    createdAt: row.created_at as string,
  }
}

// 프로필 스탯라인 직렬화 — 납득률 = convinced/review (평가 없으면 null)
export function serializeJudgeStats(p: JudgeProfile) {
  const convincedRate = p.reviewCount > 0 ? Math.round((p.convincedCount / p.reviewCount) * 100) : null
  const topTags = Object.entries(p.tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag)
  return {
    bio: p.bio,
    verdictCount: p.verdictCount,
    reviewCount: p.reviewCount,
    convincedRate,
    topTags,
  }
}

export async function getJudgeProfile(userId: string): Promise<JudgeProfile | null> {
  const db = getSupabase()
  const { data } = await db.from('judge_profiles').select().eq('user_id', userId).maybeSingle()
  return data ? toProfile(data) : null
}

export async function getOrCreateJudgeProfile(userId: string): Promise<JudgeProfile> {
  const existing = await getJudgeProfile(userId)
  if (existing) return existing
  const db = getSupabase()
  const { data, error } = await db
    .from('judge_profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error || !data) throw error ?? new Error('judge profile 생성 실패')
  return toProfile(data)
}

export async function updateJudgeBio(userId: string, bio: string): Promise<JudgeProfile> {
  await getOrCreateJudgeProfile(userId)
  const db = getSupabase()
  const { data, error } = await db
    .from('judge_profiles')
    .update({ bio, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error || !data) throw error ?? new Error('judge profile 갱신 실패')
  return toProfile(data)
}

// ── 지원서 ──

export async function listApplications(roomCode: string): Promise<JudgeApplication[]> {
  const db = getSupabase()
  const { data } = await db
    .from('judge_applications')
    .select()
    .eq('room_code', roomCode)
    .order('created_at', { ascending: true })
  return (data ?? []).map(toApplication)
}

export async function getApplication(id: string): Promise<JudgeApplication | null> {
  const db = getSupabase()
  const { data } = await db.from('judge_applications').select().eq('id', id).maybeSingle()
  return data ? toApplication(data) : null
}

export async function createApplication(
  roomCode: string,
  judgeUserId: string,
  pitch: string,
): Promise<JudgeApplication | { error: string }> {
  const db = getSupabase()
  const existing = await listApplications(roomCode)
  const active = existing.filter((a) => a.status !== 'withdrawn')
  if (active.length >= MAX_APPLICANTS) return { error: '지원이 마감됐어요 (최대 10명)' }
  if (existing.some((a) => a.judgeUserId === judgeUserId && a.status !== 'withdrawn')) {
    return { error: '이미 지원한 사건이에요' }
  }

  // 재지원(withdrawn 이력)이면 기존 행 재활성화, 아니면 insert
  const withdrawn = existing.find((a) => a.judgeUserId === judgeUserId && a.status === 'withdrawn')
  if (withdrawn) {
    const updated = await updateApplication(withdrawn.id, { status: 'applied', pitch })
    return updated ?? { error: '지원 처리 중 오류가 발생했어요' }
  }

  const { data, error } = await db
    .from('judge_applications')
    .insert({ room_code: roomCode, judge_user_id: judgeUserId, pitch })
    .select()
    .single()
  if (error?.code === '23505') return { error: '이미 지원한 사건이에요' }
  if (error || !data) return { error: '지원 처리 중 오류가 발생했어요' }
  return toApplication(data)
}

export async function updateApplication(
  id: string,
  updates: Partial<Pick<JudgeApplication, 'status' | 'pitch' | 'rejectCount'>>,
): Promise<JudgeApplication | null> {
  const db = getSupabase()
  const dbUpdates: Record<string, unknown> = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.pitch !== undefined) dbUpdates.pitch = updates.pitch
  if (updates.rejectCount !== undefined) dbUpdates.reject_count = updates.rejectCount
  const { data, error } = await db
    .from('judge_applications')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()
  if (error || !data) return null
  return toApplication(data)
}

// 지원서 목록 + 판사 표시정보(profiles)/스탯(judge_profiles) 합성
// FK 조인이 없어(테이블 간 REFERENCES 미정의) 수동 merge.
export async function listApplicationsWithJudgeInfo(roomCode: string) {
  const db = getSupabase()
  const apps = await listApplications(roomCode)
  const userIds = [...new Set(apps.map((a) => a.judgeUserId))]
  if (userIds.length === 0) return []

  const [{ data: profiles }, { data: judgeProfiles }] = await Promise.all([
    db.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds),
    db.from('judge_profiles').select().in('user_id', userIds),
  ])
  const nameMap = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))
  const statsMap = new Map((judgeProfiles ?? []).map((p) => [p.user_id as string, toProfile(p)]))

  return apps.map((a) => {
    const display = nameMap.get(a.judgeUserId)
    const stats = statsMap.get(a.judgeUserId)
    return {
      id: a.id,
      status: a.status,
      pitch: a.pitch,
      rejectCount: a.rejectCount,
      createdAt: a.createdAt,
      judge: {
        userId: a.judgeUserId,
        displayName: (display?.display_name as string) ?? '알 수 없음',
        avatarUrl: (display?.avatar_url as string | null) ?? null,
        ...(stats ? serializeJudgeStats(stats) : { bio: '', verdictCount: 0, reviewCount: 0, convincedRate: null, topTags: [] }),
      },
    }
  })
}

// ── 모집중 사건 리스트 (판사용, 익명 화이트리스트) ──

export async function listRecruitingCases(excludeUserId: string) {
  const db = getSupabase()
  const { data: rooms } = await db
    .from('rooms')
    .select('code, case_summary, created_at, recruit_deadline, user_id_a, user_id_b')
    .eq('status', 'recruiting_judge')
    .order('created_at', { ascending: false })
    .limit(50)

  const visible = (rooms ?? []).filter(
    (r) => r.user_id_a !== excludeUserId && r.user_id_b !== excludeUserId,
  )
  if (visible.length === 0) return []

  const codes = visible.map((r) => r.code as string)
  const { data: apps } = await db
    .from('judge_applications')
    .select('room_code, status, judge_user_id')
    .in('room_code', codes)

  const countMap = new Map<string, number>()
  const appliedSet = new Set<string>()
  for (const a of apps ?? []) {
    if (a.status === 'withdrawn') continue
    countMap.set(a.room_code as string, (countMap.get(a.room_code as string) ?? 0) + 1)
    if (a.judge_user_id === excludeUserId) appliedSet.add(a.room_code as string)
  }

  // ⚠️ 익명 화이트리스트: 닉네임/아바타/주장 원문 절대 미포함
  return visible.map((r) => ({
    code: r.code as string,
    caseSummary: (r.case_summary as string | null) ?? '',
    createdAt: r.created_at as number,
    recruitDeadline: (r.recruit_deadline as string | null) ?? null,
    applicantCount: countMap.get(r.code as string) ?? 0,
    applied: appliedSet.has(r.code as string),
  }))
}

// 내가 판사로 확정된 진행중/완료 사건 (판사 홈 진입용)
export async function listMyJudgingCases(judgeUserId: string) {
  const db = getSupabase()
  const { data: rooms } = await db
    .from('rooms')
    .select('code, case_summary, status, created_at')
    .eq('judge_user_id', judgeUserId)
    .in('status', ['analyzing', 'clarifying', 'verdict'])
    .order('created_at', { ascending: false })
    .limit(20)
  return (rooms ?? []).map((r) => ({
    code: r.code as string,
    caseSummary: (r.case_summary as string | null) ?? '',
    status: r.status as string,
    createdAt: r.created_at as number,
  }))
}

// ── 평가 ──

export async function createReview(input: {
  roomCode: string
  reviewerSide: 'A' | 'B'
  reviewerUserId: string | null
  judgeUserId: string
  convinced: boolean
  tags: string[]
  reasonTags: string[]
}): Promise<{ ok: true } | { error: string; status: number }> {
  const db = getSupabase()
  const { error } = await db.from('verdict_reviews').insert({
    room_code: input.roomCode,
    reviewer_side: input.reviewerSide,
    reviewer_user_id: input.reviewerUserId,
    judge_user_id: input.judgeUserId,
    convinced: input.convinced,
    tags: input.tags,
    reason_tags: input.reasonTags,
  })
  if (error?.code === '23505') return { error: '이미 평가했어요', status: 409 }
  if (error) return { error: '평가 처리 중 오류가 발생했어요', status: 500 }

  // 판사 프로필 통계 캐시 갱신 (정본은 verdict_reviews)
  const profile = await getOrCreateJudgeProfile(input.judgeUserId)
  const tagCounts = { ...profile.tagCounts }
  for (const tag of input.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
  await db
    .from('judge_profiles')
    .update({
      review_count: profile.reviewCount + 1,
      convinced_count: profile.convincedCount + (input.convinced ? 1 : 0),
      tag_counts: tagCounts,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.judgeUserId)

  return { ok: true }
}

export async function incrementVerdictCount(judgeUserId: string) {
  const db = getSupabase()
  const profile = await getOrCreateJudgeProfile(judgeUserId)
  await db
    .from('judge_profiles')
    .update({ verdict_count: profile.verdictCount + 1, updated_at: new Date().toISOString() })
    .eq('user_id', judgeUserId)
}
