import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, cancelDeletion } from '@/lib/account'

// 유예 기간 내 재로그인 시 탈퇴 예약 취소 (계정 복구)
export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  try {
    await cancelDeletion(user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '복구 처리 중 오류가 발생했어요' }, { status: 500 })
  }
}
