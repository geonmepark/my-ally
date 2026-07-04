import { createRoom } from '@/lib/roomStore'
import { getProfile } from '@/lib/profileStore'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
  const serviceClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const authHeader = request.headers.get('authorization')
  let userId: string | null = null
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await serviceClient.auth.getUser(token)
    userId = user?.id ?? null
  }
  if (judgeType === 'human' && !userId) {
    return NextResponse.json({ error: '시민판사 방은 로그인이 필요해요' }, { status: 401 })
  }

  const room = await createRoom(nickname, { judge, judgeType, caseSummary })

  // 로그인한 유저라면 user_id_a 저장
  if (userId) {
    const profile = await getProfile(userId)
    await serviceClient
      .from('rooms')
      .update({ user_id_a: userId, avatar_a: profile?.avatarUrl ?? null })
      .eq('code', room.code)
  }

  return NextResponse.json({ code: room.code, nicknameA: room.nicknameA })
}
