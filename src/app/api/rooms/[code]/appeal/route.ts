import { getRoom, updateRoom } from '@/lib/roomStore'
import { requestRetrial } from '../submit/route'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const side = String(body.side ?? '').toUpperCase()
  const action = String(body.action ?? '') // 'start' | 'loser-submit' | 'respond'
  const content = String(body.content ?? '').trim()

  if (side !== 'A' && side !== 'B') {
    return NextResponse.json({ error: 'side는 A 또는 B여야 해요' }, { status: 400 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })

  // ── 재심 시작 (텍스트 없이 즉시) ──────────────────────────────
  if (action === 'start') {
    if (room.status !== 'verdict') {
      return NextResponse.json({ error: '판결 완료 상태에서만 재심을 신청할 수 있어요' }, { status: 400 })
    }
    if (room.retrialDone) {
      return NextResponse.json({ error: '이미 재심이 완료됐어요' }, { status: 400 })
    }
    if (room.winner === side) {
      return NextResponse.json({ error: '이긴 측은 재심을 신청할 수 없어요' }, { status: 400 })
    }
    const updated = await updateRoom(code, { appealBy: side as 'A' | 'B', status: 'appealing' })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요. DB 컬럼이 없거나 연결 오류일 수 있어요.' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── 진 쪽 재심 내용 제출 ──────────────────────────────────────
  if (action === 'loser-submit') {
    if (room.status !== 'appealing') {
      return NextResponse.json({ error: '재심 진행 중에만 제출할 수 있어요' }, { status: 400 })
    }
    if (room.winner === side) {
      return NextResponse.json({ error: '이긴 측은 재심 내용을 제출할 수 없어요' }, { status: 400 })
    }
    if (room.appealText) {
      return NextResponse.json({ error: '이미 재심 내용을 제출했어요' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: '억울한 내용을 입력해주세요' }, { status: 400 })
    }
    if (content.length > 500) {
      return NextResponse.json({ error: '500자를 초과할 수 없어요' }, { status: 400 })
    }
    await updateRoom(code, { appealText: content })
    return NextResponse.json({ success: true })
  }

  // ── 이긴 쪽 응답 ─────────────────────────────────────────────
  if (action === 'respond') {
    if (room.status !== 'appealing') {
      return NextResponse.json({ error: '재심 진행 중에만 응답할 수 있어요' }, { status: 400 })
    }
    if (room.winner !== side) {
      return NextResponse.json({ error: '이긴 측만 응답할 수 있어요' }, { status: 400 })
    }
    if (!room.appealText) {
      return NextResponse.json({ error: '상대방이 아직 재심 내용을 제출하지 않았어요' }, { status: 400 })
    }

    // content = '' 이면 의견 유지 (null이 아닌 빈 문자열로 저장)
    const updated = await updateRoom(code, { winnerNote: content, status: 'analyzing' })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })

    void requestRetrial(code, updated)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action은 start / loser-submit / respond 중 하나여야 해요' }, { status: 400 })
}
