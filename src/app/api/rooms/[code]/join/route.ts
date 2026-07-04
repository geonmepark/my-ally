import { joinRoom, getRoom } from '@/lib/roomStore'
import { getProfile } from '@/lib/profileStore'
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

  // 인증 확인 — 시민판사 방은 판사 선택 동의·평가에 user id가 필수라 B도 로그인 강제
  const serviceClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const authHeader = req.headers.get('authorization')
  let userId: string | null = null
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await serviceClient.auth.getUser(token)
    userId = user?.id ?? null
  }

  const existing = await getRoom(code)
  if (!existing) {
    return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  }
  if (existing.judgeType === 'human' && !userId) {
    return NextResponse.json({ error: '시민판사 방은 로그인이 필요해요' }, { status: 401 })
  }

  const result = await joinRoom(code, nickname)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  // 로그인한 유저라면 user_id_b 저장
  if (userId) {
    const profile = await getProfile(userId)
    await serviceClient
      .from('rooms')
      .update({ user_id_b: userId, avatar_b: profile?.avatarUrl ?? null })
      .eq('code', code)
  }

  return NextResponse.json({
    code: result.code,
    nicknameA: result.nicknameA,
    nicknameB: result.nicknameB,
  })
}
