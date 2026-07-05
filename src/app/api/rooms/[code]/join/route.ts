import { joinRoom, getRoom } from '@/lib/roomStore'
import { getProfile } from '@/lib/profileStore'
import { getAuthedUser } from '@/lib/account'
import { NextRequest, NextResponse } from 'next/server'

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
  const user = await getAuthedUser(req.headers.get('authorization'))

  const existing = await getRoom(code)
  if (!existing) {
    return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  }
  if (existing.judgeType === 'human' && !user) {
    return NextResponse.json({ error: '시민판사 방은 로그인이 필요해요' }, { status: 401 })
  }

  // 신원(user_id_b/avatar_b)은 joinRoom의 원자 선점 업데이트에 함께 커밋 —
  // "닉네임만 있고 user_id 없는" 반쪽 참여(후속 authz 파손) 차단.
  const profile = user ? await getProfile(user.id) : null
  const result = await joinRoom(
    code,
    nickname,
    user ? { userId: user.id, avatarUrl: profile?.avatarUrl ?? null } : undefined,
  )

  if ('error' in result) {
    // 방 부재만 404 — "이미 두 명 참여"/"판결 완료"는 방이 존재하므로 400이 맞다
    const status = result.error === '방을 찾을 수 없어요' ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    code: result.code,
    nicknameA: result.nicknameA,
    nicknameB: result.nicknameB,
  })
}
