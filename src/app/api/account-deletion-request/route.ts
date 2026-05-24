import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const reason = body.reason ? String(body.reason).trim().slice(0, 1000) : null;

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: '올바른 이메일 주소를 입력해주세요' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('account_deletion_requests').insert({
      email,
      reason,
      source: 'web',
    });
    if (error) {
      return NextResponse.json({ error: '요청 접수 중 오류가 발생했어요' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '요청 접수 중 오류가 발생했어요' }, { status: 500 });
  }
}
