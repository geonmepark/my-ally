import { joinRoom } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const nickname = String(body.nickname ?? '').trim()

  if (!nickname) {
    return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
  }
  if (nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요' }, { status: 400 })
  }

  const result = await joinRoom(code, nickname)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({
    code: result.code,
    nicknameA: result.nicknameA,
    nicknameB: result.nicknameB,
  })
}
