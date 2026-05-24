import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// 신고 목록 조회 (운영자 전용). x-admin-secret 헤더로 보호.
export async function GET(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (!secret || request.headers.get('x-admin-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const status = request.nextUrl.searchParams.get('status') ?? 'pending'
  const db = getSupabase()
  const { data, error } = await db
    .from('reports')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }
  return NextResponse.json({ reports: data ?? [] })
}
