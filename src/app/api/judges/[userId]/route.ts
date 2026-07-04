import { getAuthedUser } from '@/lib/account'
import { getJudgeProfile, serializeJudgeStats } from '@/lib/judgeStore'
import { getProfile } from '@/lib/profileStore'
import { NextRequest, NextResponse } from 'next/server'

// 시민판사 공개 프로필 (스탯라인: 판결수 · 납득률 · 대표 태그)
// 갈등자가 지원자를 판단할 때 보는 화면의 데이터 소스.
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getAuthedUser(req.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { userId } = await params
  const judgeProfile = await getJudgeProfile(userId)
  if (!judgeProfile) {
    return NextResponse.json({ error: '판사 프로필이 없어요' }, { status: 404 })
  }
  const displayProfile = await getProfile(userId)

  return NextResponse.json({
    userId,
    displayName: displayProfile?.displayName ?? '알 수 없음',
    avatarUrl: displayProfile?.avatarUrl ?? null,
    ...serializeJudgeStats(judgeProfile),
  })
}
