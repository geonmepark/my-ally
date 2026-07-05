import { getRoom, updateRoom, claimBothResubmitted } from '@/lib/roomStore'
import { getAuthedUser } from '@/lib/account'
import { requestFinalVerdict } from '@/app/api/rooms/[code]/submit/route'
import { notifyJudgeResubmitted } from '@/lib/push'
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

  // 시민판사 방: side 자기주장 금지 — 로그인 + userIdA/B 대조 (submit과 동일 원칙)
  if (room.judgeType === 'human') {
    const user = await getAuthedUser(req.headers.get('authorization'))
    if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
    const mySide = room.userIdA === user.id ? 'A' : room.userIdB === user.id ? 'B' : null
    if (!mySide || mySide !== side) {
      return NextResponse.json({ error: '본인 측으로만 답변할 수 있어요' }, { status: 403 })
    }
  }

  if (side === 'A' && room.resubmissionA) {
    return NextResponse.json({ error: '이미 답변했어요' }, { status: 400 })
  }
  if (side === 'B' && room.resubmissionB) {
    return NextResponse.json({ error: '이미 답변했어요' }, { status: 400 })
  }

  const update = side === 'A' ? { resubmissionA: content } : { resubmissionB: content }
  const updated = await updateRoom(code, update)
  if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })

  // 전이는 원자 선점 — 동시 재제출 시 전이 유실/AI 이중 트리거 방지. 선점 성공 요청만 후속 처리.
  const claimed = await claimBothResubmitted(code)

  if (claimed) {
    if (claimed.judgeType === 'human') {
      // 시민판사 방: AI 최종판결 대신 판사에게 "최종 판결 차례" 푸시
      if (claimed.judgeUserId) notifyJudgeResubmitted(code, claimed.judgeUserId).catch(() => {})
    } else {
      void requestFinalVerdict(
        code,
        claimed.nicknameA,
        claimed.nicknameB!,
        claimed.submissionA!,
        claimed.submissionB!,
        claimed.clarificationA!,
        claimed.clarificationB!,
        claimed.resubmissionA!,
        claimed.resubmissionB!,
        claimed.judge,
      )
    }
  }

  const bothResubmitted = !!(updated.resubmissionA && updated.resubmissionB) || !!claimed
  return NextResponse.json({ success: true, analyzing: bothResubmitted })
}
