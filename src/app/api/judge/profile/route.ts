import { getAuthedUser } from '@/lib/account'
import { getOrCreateJudgeProfile, serializeJudgeStats, updateJudgeBio } from '@/lib/judgeStore'
import { NextRequest, NextResponse } from 'next/server'

const BIO_MAX = 200

// 내 시민판사 프로필 (bio + 스탯) — ProfileScreen '판사 소개' 섹션용
export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const profile = await getOrCreateJudgeProfile(user.id)
  return NextResponse.json(serializeJudgeStats(profile))
}

// bio 편집 (지원 시 pitch 초안으로 자동채움되는 기본 자기소개)
export async function PUT(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const bio = String(body.bio ?? '').trim()
  if (bio.length > BIO_MAX) {
    return NextResponse.json({ error: `소개는 ${BIO_MAX}자 이하로 입력해주세요` }, { status: 400 })
  }
  const profile = await updateJudgeBio(user.id, bio)
  return NextResponse.json(serializeJudgeStats(profile))
}
