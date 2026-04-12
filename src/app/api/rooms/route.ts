import { createRoom } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const nickname = String(body.nickname ?? '').trim()

  if (!nickname) {
    return NextResponse.json({ error: '닉네임을 입력해주세요' }, { status: 400 })
  }
  if (nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요' }, { status: 400 })
  }

  const judge = String(body.judge ?? 'gemini')
  const room = await createRoom(nickname, judge)
  return NextResponse.json({ code: room.code, nicknameA: room.nicknameA })
}
