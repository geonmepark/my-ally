import { getRoom, updateRoom } from '@/lib/roomStore'
import { analyzeAndDecide } from '../submit/route'
import { getAuthedUser } from '@/lib/account'
import {
  MAX_REJECTS,
  createApplication,
  getApplication,
  getOrCreateJudgeProfile,
  listApplications,
  listApplicationsWithJudgeInfo,
  updateApplication,
} from '@/lib/judgeStore'
import { notifyJudgeSelected, notifyNewApplication } from '@/lib/push'
import { NextRequest, NextResponse } from 'next/server'

const PITCH_MAX = 300

// ── 시민판사 지원·선택 플로우 ─────────────────────────────────────
// action: apply(판사 지원) | withdraw(지원 철회)
//       | propose(방장A가 판사 지목) | accept·reject(상대B 동의/거부)
//       | switch-to-ai(당사자가 스스로 AI 판사로 전환 — 자동 폴백 없음)
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getAuthedUser(req.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.judgeType !== 'human') {
    return NextResponse.json({ error: '시민판사 방이 아니에요' }, { status: 400 })
  }

  const isPartyA = room.userIdA === user.id
  const isPartyB = room.userIdB === user.id
  const isParty = isPartyA || isPartyB

  // ── 판사 지원 ──
  if (action === 'apply') {
    if (room.status !== 'recruiting_judge') {
      return NextResponse.json({ error: '판사 모집 중이 아니에요' }, { status: 400 })
    }
    if (isParty) {
      return NextResponse.json({ error: '본인 사건에는 지원할 수 없어요' }, { status: 400 })
    }
    const pitch = String(body.pitch ?? '').trim()
    if (!pitch) {
      return NextResponse.json({ error: '지원 소개를 입력해주세요' }, { status: 400 })
    }
    if (pitch.length > PITCH_MAX) {
      return NextResponse.json({ error: `지원 소개는 ${PITCH_MAX}자 이하로 입력해주세요` }, { status: 400 })
    }
    await getOrCreateJudgeProfile(user.id) // 판사 프로필 lazy 생성
    const result = await createApplication(code, user.id, pitch)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    notifyNewApplication(code).catch(() => {})
    return NextResponse.json({ success: true, applicationId: result.id })
  }

  // ── 지원 철회 ──
  if (action === 'withdraw') {
    const apps = await listApplications(code)
    const mine = apps.find((a) => a.judgeUserId === user.id && (a.status === 'applied' || a.status === 'proposed'))
    if (!mine) {
      return NextResponse.json({ error: '철회할 지원이 없어요' }, { status: 400 })
    }
    await updateApplication(mine.id, { status: 'withdrawn' })
    return NextResponse.json({ success: true })
  }

  // ── 방장(A)이 판사 지목 ──
  if (action === 'propose') {
    if (!isPartyA) {
      return NextResponse.json({ error: '방장만 판사를 지목할 수 있어요' }, { status: 403 })
    }
    if (room.status !== 'recruiting_judge') {
      return NextResponse.json({ error: '판사 모집 중이 아니에요' }, { status: 400 })
    }
    const apps = await listApplications(code)
    if (apps.some((a) => a.status === 'proposed')) {
      return NextResponse.json({ error: '이미 지목한 판사가 있어요. 상대방의 응답을 기다려주세요' }, { status: 400 })
    }
    const app = await getApplication(String(body.applicationId ?? ''))
    if (!app || app.roomCode !== code.toUpperCase().trim()) {
      return NextResponse.json({ error: '지원서를 찾을 수 없어요' }, { status: 404 })
    }
    if (app.status !== 'applied') {
      return NextResponse.json({ error: '지목할 수 없는 지원서예요' }, { status: 400 })
    }
    // applied일 때만 원자 갱신 — 더블클릭으로 proposed가 2개 생겨 흐름이 잠기는 것 방지
    const proposed = await updateApplication(app.id, { status: 'proposed' }, 'applied')
    if (!proposed) return NextResponse.json({ error: '이미 처리된 지원서예요' }, { status: 409 })
    return NextResponse.json({ success: true })
  }

  // ── 상대(B)의 동의/거부 ──
  if (action === 'accept' || action === 'reject') {
    if (!isPartyB) {
      return NextResponse.json({ error: '상대 당사자만 동의/거부할 수 있어요' }, { status: 403 })
    }
    if (room.status !== 'recruiting_judge') {
      return NextResponse.json({ error: '판사 모집 중이 아니에요' }, { status: 400 })
    }
    const app = await getApplication(String(body.applicationId ?? ''))
    if (!app || app.roomCode !== code.toUpperCase().trim() || app.status !== 'proposed') {
      return NextResponse.json({ error: '지목된 지원서가 아니에요' }, { status: 400 })
    }

    if (action === 'reject') {
      const rejectCount = app.rejectCount + 1
      // 3회 누적 거부 → 이 방에서 채택 불가(excluded). 다른 지원자는 그대로 유효.
      // proposed일 때만 원자 갱신 — 동시 accept/reject 이중 처리 방지.
      const rejected = await updateApplication(
        app.id,
        { rejectCount, status: rejectCount >= MAX_REJECTS ? 'excluded' : 'applied' },
        'proposed',
      )
      if (!rejected) return NextResponse.json({ error: '이미 처리된 지원서예요' }, { status: 409 })
      return NextResponse.json({ success: true, excluded: rejectCount >= MAX_REJECTS })
    }

    // accept → 판사 확정, 판결 작성 단계로 (기존 analyzing 재사용 — 앱이 judgeType으로 문구 분기)
    // proposed일 때만 원자 갱신 — reject와의 동시 처리 레이스 차단.
    const selected = await updateApplication(app.id, { status: 'selected' }, 'proposed')
    if (!selected) return NextResponse.json({ error: '이미 처리된 지원서예요' }, { status: 409 })
    const updated = await updateRoom(code, { judgeUserId: app.judgeUserId, status: 'analyzing' })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })
    notifyJudgeSelected(code, app.judgeUserId).catch(() => {})
    return NextResponse.json({ success: true })
  }

  // ── 당사자의 AI 판사 전환 (스스로 선택 — "실패로 넘어감" 없음) ──
  if (action === 'switch-to-ai') {
    if (!isParty) {
      return NextResponse.json({ error: '당사자만 전환할 수 있어요' }, { status: 403 })
    }
    if (room.status !== 'recruiting_judge') {
      return NextResponse.json({ error: '판사 모집 중에만 전환할 수 있어요' }, { status: 400 })
    }
    const updated = await updateRoom(code, { judgeType: 'ai', judgeUserId: null, status: 'analyzing' })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })
    void analyzeAndDecide(
      code,
      updated.nicknameA,
      updated.nicknameB!,
      updated.submissionA!,
      updated.submissionB!,
      updated.judge,
    )
    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: 'action은 apply / withdraw / propose / accept / reject / switch-to-ai 중 하나여야 해요' },
    { status: 400 },
  )
}

// ── 역할별 조회 ───────────────────────────────────────────────────
// 당사자 → 지원서 목록(+판사 스탯). 선택된 판사 → 사건 원문 열람(판사 시점 유일한 열람 경로).
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getAuthedUser(req.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.judgeType !== 'human') {
    return NextResponse.json({ error: '시민판사 방이 아니에요' }, { status: 400 })
  }

  // 당사자: 지원서 목록
  if (room.userIdA === user.id || room.userIdB === user.id) {
    const applications = await listApplicationsWithJudgeInfo(code.toUpperCase().trim())
    return NextResponse.json({
      role: room.userIdA === user.id ? 'partyA' : 'partyB',
      recruitDeadline: room.recruitDeadline,
      applications: applications.filter((a) => a.status !== 'withdrawn'),
    })
  }

  // 확정된 판사: 사건 전체 열람 (판결에 필요한 원문 — 이 경로가 유일)
  if (room.judgeUserId === user.id) {
    return NextResponse.json({
      role: 'judge',
      case: {
        code: room.code,
        status: room.status,
        caseSummary: room.caseSummary,
        nicknameA: room.nicknameA,
        nicknameB: room.nicknameB,
        submissionA: room.submissionA,
        submissionB: room.submissionB,
        clarificationA: room.clarificationA,
        clarificationB: room.clarificationB,
        resubmissionA: room.resubmissionA,
        resubmissionB: room.resubmissionB,
        verdictText: room.verdictText,
        winner: room.winner,
      },
    })
  }

  // 지원자 본인: 내 지원 상태만
  const apps = await listApplications(code.toUpperCase().trim())
  const mine = apps.find((a) => a.judgeUserId === user.id)
  if (mine) {
    return NextResponse.json({
      role: 'applicant',
      application: { id: mine.id, status: mine.status, pitch: mine.pitch },
      caseSummary: room.caseSummary,
    })
  }

  return NextResponse.json({ error: '접근 권한이 없어요' }, { status: 403 })
}
