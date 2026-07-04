import { getRoom, updateRoom } from '@/lib/roomStore'
import { getAuthedUser } from '@/lib/account'
import { incrementVerdictCount } from '@/lib/judgeStore'
import { notifyJudgeClarify, notifyVerdict } from '@/lib/push'
import { NextRequest, NextResponse } from 'next/server'

const QUESTION_MAX = 300
const VERDICT_MAX = 3000

// ── 시민판사 전용: 추가질문/판결 제출 ──────────────────────────────
// authz: 확정된 판사(rooms.judge_user_id) 본인만.
// action: clarify(양측에 추가질문 → status='clarifying', 기존 컬럼 재사용)
//       | verdict(최종 판결 — winner는 A/B 강제, 무승부 없음)
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getAuthedUser(req.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.judgeType !== 'human') {
    return NextResponse.json({ error: '시민판사 방이 아니에요' }, { status: 400 })
  }
  if (room.judgeUserId !== user.id) {
    return NextResponse.json({ error: '이 사건의 판사만 판결할 수 있어요' }, { status: 403 })
  }
  if (room.status !== 'analyzing') {
    return NextResponse.json({ error: '판결을 작성할 수 있는 상태가 아니에요' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? '')

  // ── 추가질문 (1회 — 기존 clarification 컬럼 재사용) ──
  if (action === 'clarify') {
    if (room.clarificationA || room.clarificationB) {
      return NextResponse.json({ error: '추가 질문은 한 번만 할 수 있어요' }, { status: 400 })
    }
    const questionA = String(body.questionA ?? '').trim()
    const questionB = String(body.questionB ?? '').trim()
    if (!questionA || !questionB) {
      return NextResponse.json({ error: '양측 모두에게 질문을 입력해주세요' }, { status: 400 })
    }
    if (questionA.length > QUESTION_MAX || questionB.length > QUESTION_MAX) {
      return NextResponse.json({ error: `질문은 ${QUESTION_MAX}자 이하로 입력해주세요` }, { status: 400 })
    }
    const updated = await updateRoom(code, {
      status: 'clarifying',
      clarificationA: questionA,
      clarificationB: questionB,
    })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })
    notifyJudgeClarify(code).catch(() => {})
    return NextResponse.json({ success: true })
  }

  // ── 최종 판결 ──
  if (action === 'verdict') {
    const winner = String(body.winner ?? '').toUpperCase()
    const verdictText = String(body.verdictText ?? '').trim()
    if (winner !== 'A' && winner !== 'B') {
      return NextResponse.json({ error: '승자를 A 또는 B로 선택해주세요' }, { status: 400 })
    }
    if (!verdictText) {
      return NextResponse.json({ error: '판결문을 입력해주세요' }, { status: 400 })
    }
    if (verdictText.length > VERDICT_MAX) {
      return NextResponse.json({ error: `판결문은 ${VERDICT_MAX}자 이하로 입력해주세요` }, { status: 400 })
    }
    const updated = await updateRoom(code, {
      status: 'verdict',
      verdictText,
      winner: winner as 'A' | 'B',
    })
    if (!updated) return NextResponse.json({ error: '처리 중 오류가 발생했어요' }, { status: 500 })
    incrementVerdictCount(user.id).catch(() => {})
    notifyVerdict(code).catch(() => {})
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'action은 clarify / verdict 중 하나여야 해요' }, { status: 400 })
}
