import { getRoom } from '@/lib/roomStore'
import { getProfile } from '@/lib/profileStore'
import { getSupabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const room = await getRoom(code)

  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  }

  const isVerdict = room.status === 'verdict'
  const showAppealText = room.status === 'appealing' || room.retrialDone

  // ── 시민판사 부가 정보 (human 방에서만 조회) ──
  const isHuman = room.judgeType === 'human'
  let judgeName: string | null = null
  let applicantCount = 0
  let reviewedA = false
  let reviewedB = false
  if (isHuman) {
    const db = getSupabase()
    if (room.judgeUserId) {
      const judgeProfile = await getProfile(room.judgeUserId)
      judgeName = judgeProfile?.displayName ?? null
    }
    if (room.status === 'recruiting_judge') {
      const { count } = await db
        .from('judge_applications')
        .select('id', { count: 'exact', head: true })
        .eq('room_code', room.code)
        .neq('status', 'withdrawn')
      applicantCount = count ?? 0
    }
    if (isVerdict) {
      const { data: reviews } = await db
        .from('verdict_reviews')
        .select('reviewer_side')
        .eq('room_code', room.code)
      reviewedA = (reviews ?? []).some((r) => r.reviewer_side === 'A')
      reviewedB = (reviews ?? []).some((r) => r.reviewer_side === 'B')
    }
  }

  return NextResponse.json({
    code: room.code,
    status: room.status,
    nicknameA: room.nicknameA,
    nicknameB: room.nicknameB,
    avatarA: room.avatarA,
    avatarB: room.avatarB,
    // 제출 여부 (판결 전까지 내용 비공개, 판결 후 공개)
    submittedA: !!room.submissionA,
    submittedB: !!room.submissionB,
    submissionA: isVerdict ? room.submissionA : null,
    submissionB: isVerdict ? room.submissionB : null,
    // 추가 질문 (논점 불일치 시 — AI/시민판사 공용)
    clarificationA: room.clarificationA,
    clarificationB: room.clarificationB,
    resubmittedA: !!room.resubmissionA,
    resubmittedB: !!room.resubmissionB,
    resubmissionA: isVerdict ? room.resubmissionA : null,
    resubmissionB: isVerdict ? room.resubmissionB : null,
    // 판결
    verdictText: room.verdictText,
    winner: room.winner,
    // 재심 (시민판사 방은 미지원)
    appealBy: room.appealBy,
    retrialDone: room.retrialDone,
    appealText: showAppealText ? room.appealText : null,
    appealLoserSubmitted: !!room.appealText,
    winnerResponded: room.status === 'appealing' ? room.winnerNote !== null : false,
    // 시민판사
    judgeType: room.judgeType,
    caseSummary: room.caseSummary,
    recruitDeadline: room.recruitDeadline,
    judgeName,
    applicantCount,
    reviewedA,
    reviewedB,
  })
}
