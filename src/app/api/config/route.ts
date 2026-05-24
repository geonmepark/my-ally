import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// 앱이 시작 시 가져가는 원격 설정. 테이블이 없거나 오류여도 기본값으로 안전하게 응답한다.
export async function GET() {
  const defaults = { notice: null as string | null, noticeActive: false, contactEmail: null as string | null }
  try {
    const db = getSupabase()
    const { data, error } = await db.from('app_config').select('key, value')
    if (error || !data) return NextResponse.json(defaults)
    const map = Object.fromEntries(data.map((r) => [r.key as string, r.value as string | null]))
    return NextResponse.json({
      notice: map.notice ?? null,
      noticeActive: map.notice_active === 'true',
      contactEmail: map.contact_email ?? null,
    })
  } catch {
    return NextResponse.json(defaults)
  }
}
