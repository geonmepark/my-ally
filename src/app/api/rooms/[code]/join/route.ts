import { joinRoom } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const nickname = String(body.nickname ?? '').trim()

  if (!nickname) {
    return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
  }
  if (nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요' }, { status: 400 })
  }

  const result = await joinRoom(code, nickname)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  // 로그인한 유저라면 user_id_b 저장
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: { user } } = await adminClient.auth.getUser(token)
    if (user) {
      await adminClient.from('rooms').update({ user_id_b: user.id }).eq('code', code)
    }
  }

  return NextResponse.json({
    code: result.code,
    nicknameA: result.nicknameA,
    nicknameB: result.nicknameB,
  })
}
