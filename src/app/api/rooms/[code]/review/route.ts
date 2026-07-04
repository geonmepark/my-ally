import { getRoom } from '@/lib/roomStore'
import { getAuthedUser } from '@/lib/account'
import { createReview } from '@/lib/judgeStore'
import { NextRequest, NextResponse } from 'next/server'

const MAX_TAGS = 5

// 판사 인상 태그(긍정) / 👎 이유 태그 — 앱 평가 모달과 동기화
const ALLOWED_TAGS = ['명쾌함', '논리적', '공감됨', '성의있음']
const ALLOWED_REASON_TAGS = ['편파적', '성의없음', '근거부족']

// ── 판결 평가 (시민판사 방, 당사자 side당 1회 — 재평가 불가) ──────
// convinced: "이 판결, 납득되셨나요?" — 진 쪽도 정직하게 답할 수 있는 핵심 지표.
// convinced=false면 reasonTags 필수(순수 분노 클릭 필터).
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await getAuthedUser(req.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })
  if (room.judgeType !== 'human' || !room.judgeUserId) {
    return NextResponse.json({ error: '시민판사 판결만 평가할 수 있어요' }, { status: 400 })
  }
  if (room.status !== 'verdict') {
    return NextResponse.json({ error: '판결 완료 후에 평가할 수 있어요' }, { status: 400 })
  }

  // 당사자 확인 (시민판사 방은 양측 모두 로그인 강제이므로 user id 매칭으로 side 판정)
  const side = room.userIdA === user.id ? 'A' : room.userIdB === user.id ? 'B' : null
  if (!side) {
    return NextResponse.json({ error: '이 사건의 당사자만 평가할 수 있어요' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  if (typeof body.convinced !== 'boolean') {
    return NextResponse.json({ error: '납득 여부를 선택해주세요' }, { status: 400 })
  }
  const convinced = body.convinced as boolean

  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map((t: unknown) => String(t))
    .filter((t: string) => ALLOWED_TAGS.includes(t))
    .slice(0, MAX_TAGS)
  const reasonTags = (Array.isArray(body.reasonTags) ? body.reasonTags : [])
    .map((t: unknown) => String(t))
    .filter((t: string) => ALLOWED_REASON_TAGS.includes(t))
    .slice(0, MAX_TAGS)

  if (!convinced && reasonTags.length === 0) {
    return NextResponse.json({ error: '납득이 안 된 이유를 선택해주세요' }, { status: 400 })
  }

  const result = await createReview({
    roomCode: room.code,
    reviewerSide: side,
    reviewerUserId: user.id,
    judgeUserId: room.judgeUserId,
    convinced,
    tags,
    reasonTags,
  })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true })
}
