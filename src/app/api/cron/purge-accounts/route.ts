import { NextRequest, NextResponse } from 'next/server'
import { purgeExpiredDeletions } from '@/lib/account'

// 유예 기간이 지난 탈퇴 예약을 완전 삭제한다.
// Vercel Cron이 CRON_SECRET을 Authorization: Bearer 로 전달한다.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const purged = await purgeExpiredDeletions()
    return NextResponse.json({ ok: true, purged })
  } catch {
    return NextResponse.json({ error: 'purge failed' }, { status: 500 })
  }
}
