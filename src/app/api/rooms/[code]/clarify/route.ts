import { getRoom, updateRoom } from '@/lib/roomStore'
import { requestFinalVerdict } from '@/app/api/rooms/[code]/submit/route'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const side = String(body.side ?? '').toUpperCase()
  const content = String(body.content ?? '').trim()

  if (side !== 'A' && side !== 'B') {
    return NextResponse.json({ error: 'side는 A 또는 B여야 해요' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: '답변을 입력해주세요' }, { status: 400 })
  }
  if (content.length > 500) {
    return NextResponse.json({ error: '500자를 초과할 수 없어요' }, { status: 400 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.status !== 'clarifying') return NextResponse.json({ error: '추가 답변이 필요한 상태가 아니에요' }, { status: 400 })

  if (side === 'A' && room.resubmissionA) {
    return NextResponse.json({ error: '이미 답변했어요' }, { status: 400 })
  }
  if (side === 'B' && room.resubmissionB) {
    return NextResponse.json({ error: '이미 답변했어요' }, { status: 400 })
  }

  const update = side === 'A' ? { resubmissionA: content } : { resubmissionB: content }
  const updated = await updateRoom(code, update)
  if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })

  const bothResubmitted = !!(updated.resubmissionA && updated.resubmissionB)

  if (bothResubmitted) {
    await updateRoom(code, { status: 'analyzing' })
    void requestFinalVerdict(
      code,
      updated.nicknameA,
      updated.nicknameB!,
      updated.submissionA!,
      updated.submissionB!,
      updated.clarificationA!,
      updated.clarificationB!,
      updated.resubmissionA!,
      updated.resubmissionB!,
      updated.judge,
    )
  }

  return NextResponse.json({ success: true, analyzing: bothResubmitted })
}
