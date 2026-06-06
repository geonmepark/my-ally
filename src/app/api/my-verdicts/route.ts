import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/account'

// 로그인 사용자가 참여한 '판결 완료' 방 목록.
// RLS 활성 후 클라이언트 직접 쿼리가 막히므로, 이 API(service_role)로 대체한다.
// 목록에 필요한 필드만 선별 반환한다(주장/판결 원문은 제외).
export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  try {
    const db = getSupabase()
    const { data, error } = await db
      .from('rooms')
      .select('code, nickname_a, nickname_b, winner, created_at, user_id_a, user_id_b')
      .eq('status', 'verdict')
      .or(`user_id_a.eq.${user.id},user_id_b.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (error) {
      return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
    }
    const verdicts = (data ?? []).map((r) => ({
      code: r.code,
      nickname_a: r.nickname_a,
      nickname_b: r.nickname_b,
      winner: r.winner,
      created_at: r.created_at,
      my_side: r.user_id_a === user.id ? 'A' : 'B',
    }))
    return NextResponse.json({ verdicts })
  } catch {
    return NextResponse.json({ error: '목록을 불러오지 못했어요' }, { status: 500 })
  }
}
