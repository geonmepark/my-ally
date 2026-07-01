import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/account'
import { getOrCreateProfile, updateProfile, type Profile } from '@/lib/profileStore'

function serialize(p: Profile) {
  return {
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    nameChangedAt: p.nameChangedAt,
  }
}

// 내 프로필. 없으면 SNS 메타데이터로 lazy-seed 후 반환.
export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  try {
    const profile = await getOrCreateProfile(user)
    return NextResponse.json(serialize(profile))
  } catch {
    return NextResponse.json({ error: '프로필을 불러오지 못했어요' }, { status: 500 })
  }
}

// displayName(1일 1회 제한) / avatarUrl 갱신.
export async function PATCH(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const patch: { displayName?: string; avatarUrl?: string | null } = {}
  if (typeof body.displayName === 'string') patch.displayName = body.displayName
  if (body.avatarUrl === null || typeof body.avatarUrl === 'string') patch.avatarUrl = body.avatarUrl

  if (patch.displayName === undefined && patch.avatarUrl === undefined) {
    return NextResponse.json({ error: '변경할 내용이 없어요' }, { status: 400 })
  }

  try {
    const result = await updateProfile(user, patch)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, nextChangeAt: result.nextChangeAt },
        { status: 400 },
      )
    }
    return NextResponse.json(serialize(result.profile))
  } catch {
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했어요' }, { status: 500 })
  }
}
