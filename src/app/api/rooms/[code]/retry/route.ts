import { getRoom, updateRoom } from '@/lib/roomStore'
import { analyzeAndDecide, requestFinalVerdict } from '@/app/api/rooms/[code]/submit/route'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.status !== 'failed') return NextResponse.json({ error: '재시도가 필요한 상태가 아니에요' }, { status: 400 })

  if (!room.submissionA || !room.submissionB) {
    return NextResponse.json({ error: '제출 내용이 없어요' }, { status: 400 })
  }

  await updateRoom(code, { status: 'analyzing' })

  // clarification 이후에 실패했으면 최종 판결 재시도
  const afterClarify = !!(room.resubmissionA && room.resubmissionB)

  if (afterClarify) {
    void requestFinalVerdict(
      code,
      room.nicknameA,
      room.nicknameB!,
      room.submissionA,
      room.submissionB,
      room.clarificationA!,
      room.clarificationB!,
      room.resubmissionA!,
      room.resubmissionB!,
      room.judge,
    )
  } else {
    void analyzeAndDecide(
      code,
      room.nicknameA,
      room.nicknameB!,
      room.submissionA,
      room.submissionB,
      room.judge,
    )
  }

  return NextResponse.json({ success: true })
}
