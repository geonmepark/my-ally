import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/account'

const VALID_REASONS = ['abuse', 'hate', 'defamation', 'spam', 'inappropriate', 'etc']

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const roomCode = body.roomCode ? String(body.roomCode).toUpperCase().trim() : null
  const reportedSide = body.reportedSide === 'A' || body.reportedSide === 'B' ? body.reportedSide : null
  const reason = VALID_REASONS.includes(body.reason) ? body.reason : null
  const detail = body.detail ? String(body.detail).trim().slice(0, 1000) : null

  if (!reason) {
    return NextResponse.json({ error: '신고 사유를 선택해주세요' }, { status: 400 })
  }

  const reporter = await getAuthedUser(request.headers.get('authorization'))

  try {
    const db = getSupabase()

    // 방에서 신고 대상 user_id 파악 (가능하면)
    let reportedUserId: string | null = null
    if (roomCode && reportedSide) {
      const { data: room } = await db
        .from('rooms')
        .select('user_id_a, user_id_b')
        .eq('code', roomCode)
        .maybeSingle()
      if (room) {
        reportedUserId = (reportedSide === 'A' ? room.user_id_a : room.user_id_b) ?? null
      }
    }

    const { error } = await db.from('reports').insert({
      room_code: roomCode,
      reported_side: reportedSide,
      reported_user_id: reportedUserId,
      reporter_user_id: reporter?.id ?? null,
      reason,
      detail,
    })
    if (error) {
      return NextResponse.json({ error: '신고 접수 중 오류가 발생했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '신고 접수 중 오류가 발생했어요' }, { status: 500 })
  }
}
