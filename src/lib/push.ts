import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { getSupabase } from './supabase'

const expo = new Expo()

async function tokensForUsers(userIds: (string | null | undefined)[]): Promise<string[]> {
  const ids = userIds.filter((id): id is string => !!id)
  if (ids.length === 0) return []
  const db = getSupabase()
  const { data } = await db.from('push_tokens').select('token').in('user_id', ids)
  return (data ?? []).map((r) => r.token as string).filter((t) => Expo.isExpoPushToken(t))
}

async function send(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
  if (tokens.length === 0) return
  const messages: ExpoPushMessage[] = tokens.map((to) => ({ to, sound: 'default', title, body, data }))
  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk)
    } catch (e) {
      console.error('[push] send 실패', e)
    }
  }
}

// 판결 완료 → 양쪽 참여자에게
export async function notifyVerdict(code: string) {
  const db = getSupabase()
  const { data: room } = await db
    .from('rooms')
    .select('user_id_a, user_id_b')
    .eq('code', code)
    .maybeSingle()
  if (!room) return
  const tokens = await tokensForUsers([room.user_id_a, room.user_id_b])
  await send(tokens, '결이의 심판', '결이가 판결을 내렸어요. 결과를 확인해보세요.', { roomCode: code, type: 'verdict' })
}

// 시민판사 확정 → 판사 + 양쪽 당사자에게
export async function notifyJudgeSelected(code: string, judgeUserId: string) {
  const db = getSupabase()
  const { data: room } = await db
    .from('rooms')
    .select('user_id_a, user_id_b')
    .eq('code', code)
    .maybeSingle()
  const judgeTokens = await tokensForUsers([judgeUserId])
  await send(judgeTokens, '결이의 심판', '시민판사로 선정됐어요! 사건을 검토하고 판결해주세요.', { roomCode: code, type: 'judge-selected' })
  if (room) {
    const partyTokens = await tokensForUsers([room.user_id_a, room.user_id_b])
    await send(partyTokens, '결이의 심판', '시민판사가 확정됐어요. 판결을 기다려주세요.', { roomCode: code, type: 'judge-confirmed' })
  }
}

// 추가답변 양측 완료 → 판사에게 (최종 판결 차례)
export async function notifyJudgeResubmitted(code: string, judgeUserId: string) {
  const tokens = await tokensForUsers([judgeUserId])
  await send(tokens, '결이의 심판', '양측이 추가 답변을 제출했어요. 최종 판결을 내려주세요.', { roomCode: code, type: 'judge-resubmitted' })
}

// 새 판사 지원 → 방장(A)에게
export async function notifyNewApplication(code: string) {
  const db = getSupabase()
  const { data: room } = await db
    .from('rooms')
    .select('user_id_a')
    .eq('code', code)
    .maybeSingle()
  if (!room) return
  const tokens = await tokensForUsers([room.user_id_a])
  await send(tokens, '결이의 심판', '새로운 시민판사가 지원했어요. 지원서를 확인해보세요.', { roomCode: code, type: 'judge-application' })
}

// 판사의 추가질문 → 양쪽 당사자에게
export async function notifyJudgeClarify(code: string) {
  const db = getSupabase()
  const { data: room } = await db
    .from('rooms')
    .select('user_id_a, user_id_b')
    .eq('code', code)
    .maybeSingle()
  if (!room) return
  const tokens = await tokensForUsers([room.user_id_a, room.user_id_b])
  await send(tokens, '결이의 심판', '시민판사가 추가 질문을 남겼어요. 답변해주세요.', { roomCode: code, type: 'judge-clarify' })
}

// 재심 요청(억울해요) → 이긴 쪽에게
export async function notifyAppeal(code: string) {
  const db = getSupabase()
  const { data: room } = await db
    .from('rooms')
    .select('user_id_a, user_id_b, winner')
    .eq('code', code)
    .maybeSingle()
  if (!room || !room.winner) return
  const winnerUserId = room.winner === 'A' ? room.user_id_a : room.user_id_b
  const tokens = await tokensForUsers([winnerUserId])
  await send(tokens, '결이의 심판', '상대방이 억울하다며 재심을 요청했어요.', { roomCode: code, type: 'appeal' })
}
