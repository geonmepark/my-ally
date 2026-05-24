import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser, scheduleDeletion, getDeletionStatus } from '@/lib/account'

// 탈퇴 예약 (유예 기간 후 완전 삭제)
export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  try {
    const scheduledAt = await scheduleDeletion(user.id, user.email ?? null)
    return NextResponse.json({ ok: true, scheduledAt: scheduledAt.toISOString() })
  } catch {
    return NextResponse.json({ error: '탈퇴 처리 중 오류가 발생했어요' }, { status: 500 })
  }
}

// 탈퇴 예약 상태 조회 (앱이 로그인 후 복구 안내에 사용)
export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const status = await getDeletionStatus(user.id)
  return NextResponse.json({ deletionScheduledAt: status?.scheduledAt ?? null })
}
