import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/account'
import { listMyJudgingCases, listRecruitingCases } from '@/lib/judgeStore'

// 시민판사용 모집중 사건 리스트.
// ⚠️ 익명 화이트리스트만 반환(닉네임/아바타/주장 원문 미노출) — judgeStore.listRecruitingCases가 강제.
// 본인이 당사자인 방은 제외(셀프 판결 차단 1차 관문).
export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const [cases, myCases] = await Promise.all([
    listRecruitingCases(user.id),
    listMyJudgingCases(user.id), // 내가 판사로 확정된 사건 (판결 작성 진입)
  ])
  return NextResponse.json({ cases, myCases })
}
