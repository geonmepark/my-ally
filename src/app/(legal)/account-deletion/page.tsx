import type { Metadata } from 'next';
import { LEGAL } from '../_constants';
import { DeletionRequestForm } from './DeletionRequestForm';

export const metadata: Metadata = {
  title: `계정 삭제 안내 | ${LEGAL.SERVICE_NAME}`,
  description: `${LEGAL.SERVICE_NAME} 계정 삭제 절차 및 외부 요청 양식`,
};

export default function AccountDeletionPage() {
  return (
    <>
      <h1 className="text-foreground text-2xl font-bold sm:text-3xl">계정 삭제 안내</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {LEGAL.SERVICE_NAME} 계정 삭제 절차를 안내합니다.
      </p>

      <section className="mt-10">
        <h2 className="text-foreground text-lg font-semibold sm:text-xl">앱에서 직접 삭제하기</h2>
        <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
          가장 빠른 방법입니다. 앱에 로그인한 상태에서 아래 경로로 이동해 주세요.
        </p>
        <div className="bg-muted mt-3 rounded-md px-4 py-3 font-mono text-sm">
          설정 → 계정 → 계정 삭제
        </div>
        <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
          “계정 삭제” 버튼을 누르면 2단계 확인 후 즉시 처리됩니다. 처리 결과는 화면에 안내됩니다.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground text-lg font-semibold sm:text-xl">삭제되는 정보</h2>
        <ul className="text-foreground/90 mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            <span className="font-semibold">즉시 삭제</span> — 이메일, 이름, 프로필 이미지, 로그인 식별자,
            푸시 알림 토큰, 세션 정보
          </li>
          <li>
            <span className="font-semibold">익명화 보존</span> — 이용자가 작성한 주장·추가 답변·재심
            내용 및 판결 기록은 방의 무결성 유지를 위해 작성자 식별 정보를 제거한 채 보존됩니다.
          </li>
          <li>
            <span className="font-semibold">법령상 보존</span> — 부정 이용 기록, 전자상거래법 등 관련
            법령에 따라 보존이 요구되는 정보는 해당 법령에서 정한 기간 동안 보관됩니다.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground text-lg font-semibold sm:text-xl">처리 소요 시간</h2>
        <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
          앱 내 직접 삭제는 즉시 처리되며, 익명화 작업은 1영업일 이내에 완료됩니다. 외부 양식을 통한
          요청은 본인 확인 절차를 거쳐 영업일 기준 7일 이내에 처리됩니다.
        </p>
      </section>

      <section className="mt-12 border-t pt-10">
        <h2 className="text-foreground text-lg font-semibold sm:text-xl">
          로그인이 어려운 경우 — 외부 양식
        </h2>
        <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
          앱에 더 이상 로그인할 수 없는 경우 아래 양식으로 계정 삭제를 요청할 수 있습니다. 가입 시
          사용한 이메일을 정확히 입력해 주세요. 운영자가 본인 확인 메일을 보낸 뒤 처리합니다.
        </p>
        <div className="mt-6">
          <DeletionRequestForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground text-lg font-semibold sm:text-xl">문의</h2>
        <p className="text-foreground/90 mt-3 text-sm leading-relaxed">
          위 절차로 해결되지 않는 경우{' '}
          <span className="font-mono">{LEGAL.CONTACT_EMAIL}</span> 로 문의해 주세요.
        </p>
      </section>

      <p className="text-muted-foreground mt-12 text-xs">최종 개정일: {LEGAL.LAST_UPDATED}</p>
    </>
  );
}
