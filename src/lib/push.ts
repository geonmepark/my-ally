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
