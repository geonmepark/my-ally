import { createRoom } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const nickname = String(body.nickname ?? '').trim()

  if (!nickname) {
    return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
  }
  if (nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요' }, { status: 400 })
  }

  const judge = String(body.judge ?? 'gemini')
  const room = await createRoom(nickname, judge)

  // 로그인한 유저라면 user_id_a 저장
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: { user } } = await anonClient.auth.getUser(token)
    if (user) {
      await anonClient.from('rooms').update({ user_id_a: user.id }).eq('code', room.code)
    }
  }

  return NextResponse.json({ code: room.code, nicknameA: room.nicknameA })
}
