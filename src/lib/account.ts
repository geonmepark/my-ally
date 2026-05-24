import { getSupabase } from './supabase'

export const DELETION_GRACE_DAYS = 180 // 탈퇴 유예 기간 (6개월)
const ANON_NICKNAME = '탈퇴한 사용자'

// Authorization: Bearer <access_token> 에서 인증된 유저를 얻는다.
export async function getAuthedUser(authHeader: string | null) {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  const db = getSupabase()
  const {
    data: { user },
  } = await db.auth.getUser(token)
  return user ?? null
}

// 탈퇴 예약: scheduled_at = now + grace. 이미 예약돼 있으면 갱신.
export async function scheduleDeletion(userId: string, email: string | null) {
  const db = getSupabase()
  const scheduledAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const { error } = await db.from('pending_account_deletions').upsert({
    user_id: userId,
    email,
    scheduled_at: scheduledAt.toISOString(),
    requested_at: new Date().toISOString(),
  })
  if (error) throw error
  return scheduledAt
}

export async function getDeletionStatus(userId: string) {
  const db = getSupabase()
  const { data } = await db
    .from('pending_account_deletions')
    .select('scheduled_at')
    .eq('user_id', userId)
    .maybeSingle()
  return data ? { scheduledAt: data.scheduled_at as string } : null
}

export async function cancelDeletion(userId: string) {
  const db = getSupabase()
  const { error } = await db.from('pending_account_deletions').delete().eq('user_id', userId)
  if (error) throw error
}

// 방의 개인 식별 정보 제거: user_id 해제 + 닉네임 익명화. 주장 텍스트는 보존.
async function anonymizeUserRooms(userId: string) {
  const db = getSupabase()
  await db
    .from('rooms')
    .update({ user_id_a: null, nickname_a: ANON_NICKNAME })
    .eq('user_id_a', userId)
  await db
    .from('rooms')
    .update({ user_id_b: null, nickname_b: ANON_NICKNAME })
    .eq('user_id_b', userId)
}

// 완전 삭제: 방 익명화 + auth 계정 삭제. (푸시 토큰 정리는 Phase 2에서 추가)
export async function purgeUser(userId: string) {
  const db = getSupabase()
  await anonymizeUserRooms(userId)
  await db.auth.admin.deleteUser(userId)
  await db.from('pending_account_deletions').delete().eq('user_id', userId)
}

// 유예 기간이 지난 예약 건을 모두 완전 삭제 처리한다.
export async function purgeExpiredDeletions() {
  const db = getSupabase()
  const { data, error } = await db
    .from('pending_account_deletions')
    .select('user_id')
    .lte('scheduled_at', new Date().toISOString())
  if (error) throw error
  const ids = (data ?? []).map((r) => r.user_id as string)
  for (const id of ids) {
    await purgeUser(id)
  }
  return ids.length
}
