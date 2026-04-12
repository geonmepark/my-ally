import { getRoom } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const room = await getRoom(code)

  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  }

  const isVerdict = room.status === 'verdict'
  const showAppealText = room.status === 'appealing' || room.retrialDone

  return NextResponse.json({
    code: room.code,
    status: room.status,
    nicknameA: room.nicknameA,
    nicknameB: room.nicknameB,
    // 제출 여부 (판결 전까지 내용 비공개, 판결 후 공개)
    submittedA: !!room.submissionA,
    submittedB: !!room.submissionB,
    submissionA: isVerdict ? room.submissionA : null,
    submissionB: isVerdict ? room.submissionB : null,
    // 추가 질문 (논점 불일치 시)
    clarificationA: room.clarificationA,
    clarificationB: room.clarificationB,
    resubmittedA: !!room.resubmissionA,
    resubmittedB: !!room.resubmissionB,
    resubmissionA: isVerdict ? room.resubmissionA : null,
    resubmissionB: isVerdict ? room.resubmissionB : null,
    // 판결
    verdictText: room.verdictText,
    winner: room.winner,
    // 재심
    appealBy: room.appealBy,
    retrialDone: room.retrialDone,
    appealText: showAppealText ? room.appealText : null,
    appealLoserSubmitted: !!room.appealText,
    winnerResponded: room.status === 'appealing' ? room.winnerNote !== null : false,
  })
}
