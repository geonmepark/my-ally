'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function DeletionRequestForm() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/account-deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error ?? '요청 처리 중 오류가 발생했어요');
        return;
      }
      setStatus('success');
      setEmail('');
      setReason('');
    } catch {
      setStatus('error');
      setErrorMsg('네트워크 오류가 발생했어요');
    }
  }

  if (status === 'success') {
    return (
      <div className="border-border bg-card rounded-md border p-5">
        <p className="text-foreground text-sm font-semibold">요청이 접수됐어요</p>
        <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
          입력하신 이메일로 본인 확인 안내가 발송됩니다. 영업일 기준 7일 이내에 처리될 예정이며,
          처리 완료 시 결과를 회신해 드립니다.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="del-email" className="text-foreground block text-sm font-semibold">
          가입 시 이메일 <span className="text-destructive">*</span>
        </label>
        <input
          id="del-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'loading'}
          className="border-border bg-input text-foreground focus:ring-ring mt-2 block w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-2"
          placeholder="example@email.com"
        />
      </div>

      <div>
        <label htmlFor="del-reason" className="text-foreground block text-sm font-semibold">
          삭제 사유 (선택)
        </label>
        <textarea
          id="del-reason"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={status === 'loading'}
          className="border-border bg-input text-foreground focus:ring-ring mt-2 block w-full resize-none rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-2"
          placeholder="서비스 개선에 참고할게요"
        />
        <p className="text-muted-foreground mt-1 text-right text-xs">{reason.length} / 1000</p>
      </div>

      {status === 'error' && (
        <p className="text-destructive text-sm" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading' || !email.trim()}
        className="bg-secondary text-secondary-foreground hover:bg-secondary/90 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-40"
      >
        {status === 'loading' ? '요청 중…' : '계정 삭제 요청 보내기'}
      </button>

      <p className="text-muted-foreground text-xs leading-relaxed">
        본 양식을 통한 요청은 운영자의 본인 확인 절차를 거쳐 처리됩니다. 허위 요청이 확인되면
        반려될 수 있습니다.
      </p>
    </form>
  );
}
