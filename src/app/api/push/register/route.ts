import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getAuthedUser } from '@/lib/account'

// 푸시 토큰 등록/갱신
export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request.headers.get('authorization'))
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const token = body.token ? String(body.token).trim() : null
  const platform = body.platform ? String(body.platform).slice(0, 16) : null
  if (!token) {
    return NextResponse.json({ error: '토큰이 필요해요' }, { status: 400 })
  }
  try {
    const db = getSupabase()
    const { error } = await db.from('push_tokens').upsert({
      token,
      user_id: user.id,
      platform,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      return NextResponse.json({ error: '등록 중 오류가 발생했어요' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '등록 중 오류가 발생했어요' }, { status: 500 })
  }
}
