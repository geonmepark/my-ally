import { createRoom } from '@/lib/roomStore'
import { getProfile } from '@/lib/profileStore'
import { getAuthedUser } from '@/lib/account'
import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const JUDGE_MODELS = ['gemini', 'claude']
const CASE_SUMMARY_MAX = 80

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
  if (!JUDGE_MODELS.includes(judge)) {
    return NextResponse.json({ error: '지원하지 않는 판사 모델이에요' }, { status: 400 })
  }

  const judgeType = body.judgeType === 'human' ? 'human' : 'ai'
  const caseSummary = String(body.caseSummary ?? '').trim()

  if (judgeType === 'human') {
    if (!caseSummary) {
      return NextResponse.json({ error: '사건 한 줄 소개를 입력해주세요' }, { status: 400 })
    }
    if (caseSummary.length > CASE_SUMMARY_MAX) {
      return NextResponse.json({ error: `사건 소개는 ${CASE_SUMMARY_MAX}자 이하로 입력해주세요` }, { status: 400 })
    }
  }

  // 인증 확인 — 시민판사 방은 판사 배정·평가에 user id가 필수라 로그인 강제
  // (공용 헬퍼 getAuthedUser + 싱글턴 getSupabase 사용 — 라우트별 인라인 auth 드리프트 방지)
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (judgeType === 'human' && !user) {
    return NextResponse.json({ error: '시민판사 방은 로그인이 필요해요' }, { status: 401 })
  }

  const room = await createRoom(nickname, { judge, judgeType, caseSummary })

  // 로그인한 유저라면 user_id_a 저장
  if (user) {
    const profile = await getProfile(user.id)
    await getSupabase()
      .from('rooms')
      .update({ user_id_a: user.id, avatar_a: profile?.avatarUrl ?? null })
      .eq('code', room.code)
  }

  return NextResponse.json({ code: room.code, nicknameA: room.nicknameA })
}
