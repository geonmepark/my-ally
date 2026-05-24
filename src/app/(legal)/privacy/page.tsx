import type { Metadata } from 'next';
import { H3, P, Section, Ul } from '../_components';
import { LEGAL } from '../_constants';

export const metadata: Metadata = {
  title: `개인정보처리방침 | ${LEGAL.SERVICE_NAME}`,
  description: `${LEGAL.SERVICE_NAME} 개인정보처리방침`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-foreground text-2xl font-bold sm:text-3xl">개인정보처리방침</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        시행일: {LEGAL.EFFECTIVE_DATE} · 최종 개정일: {LEGAL.LAST_UPDATED}
      </p>

      <Section title="1. 총칙">
        <P>
          {LEGAL.OPERATOR_NAME}(이하 “운영자”)은 {LEGAL.SERVICE_NAME}(이하 “서비스”)를 제공함에 있어
          이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은
          서비스 이용 과정에서 이용자의 개인정보가 어떻게 수집·이용·보관·파기되는지 안내합니다.
        </P>
      </Section>

      <Section title="2. 수집하는 개인정보 항목">
        <H3>가. 회원가입·로그인 시</H3>
        <Ul>
          <li>이메일 주소(필수)</li>
          <li>소셜 로그인 식별자 및 프로필(Google/Apple OIDC sub, 이름, 프로필 이미지)</li>
          <li>이용약관 및 개인정보처리방침 동의 일시·버전</li>
        </Ul>
        <H3>나. 서비스 이용 과정</H3>
        <Ul>
          <li>닉네임, 방 코드, 참여 사이드(A/B)</li>
          <li>이용자가 작성한 주장·추가 답변·재심 내용 등 텍스트 콘텐츠</li>
          <li>판결 결과 및 이용자 간 상호작용 기록</li>
          <li>신고 내용(신고 시 사유·자유 텍스트)</li>
        </Ul>
        <H3>다. 자동 수집 정보</H3>
        <Ul>
          <li>기기 식별자, 푸시 알림 토큰, 운영체제 및 앱 버전</li>
          <li>접속 IP, 접속 일시, 서비스 이용 기록 및 오류 로그</li>
        </Ul>
      </Section>

      <Section title="3. 개인정보의 수집·이용 목적">
        <Ul>
          <li>회원 식별 및 본인 확인, 로그인 유지</li>
          <li>AI 판사 “결이”의 판결 생성을 위한 주장 분석 및 응답 제공</li>
          <li>방 참여자 간 매칭, 판결 결과 전달</li>
          <li>판결 완료·재심 요청 등 푸시 알림 발송</li>
          <li>신고 처리, 부정 이용 방지 및 서비스 보호</li>
          <li>이용자 문의 대응 및 공지 안내</li>
          <li>서비스 품질 개선 및 통계 분석(개인을 식별할 수 없는 형태)</li>
        </Ul>
      </Section>

      <Section title="4. 개인정보의 보유 및 이용 기간">
        <P>
          운영자는 수집·이용 목적이 달성되거나 이용자가 회원 탈퇴를 신청한 경우 지체 없이
          개인정보를 파기합니다. 다만 다음의 경우 명시된 기간 동안 보관합니다.
        </P>
        <Ul>
          <li>관련 법령(전자상거래법, 통신비밀보호법 등)에 따라 보존이 필요한 정보: 해당 법령에서 정한 기간</li>
          <li>부정 이용 방지를 위해 필요한 기록: 최대 1년</li>
          <li>이용자가 작성한 주장·판결 콘텐츠: 방의 무결성 유지를 위해 작성자 식별 정보를 제거(익명화)한 뒤 보존</li>
        </Ul>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <P>
          운영자는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에
          동의하거나 법령에 따라 요구되는 경우에 한하여 제공합니다.
        </P>
      </Section>

      <Section title="6. 개인정보 처리의 위탁">
        <P>
          운영자는 서비스 제공을 위해 다음과 같은 업무를 외부에 위탁합니다. 위탁 시 개인정보가
          안전하게 처리되도록 관리·감독합니다.
        </P>
        <ul className="text-foreground/90 mt-2 space-y-2 text-sm leading-relaxed">
          <li>
            <span className="font-semibold">클라우드 인프라 및 데이터베이스</span> — 서비스 운영을
            위한 서버·데이터베이스·인증 기반 제공
          </li>
          <li>
            <span className="font-semibold">AI 모델 공급사</span> — 이용자가 작성한 주장 텍스트를
            전달하여 판결 응답 생성
          </li>
          <li>
            <span className="font-semibold">푸시 알림 발송 사업자</span> — 판결 완료·재심 요청 등
            알림 전송
          </li>
        </ul>
      </Section>

      <Section title="7. 이용자 및 법정대리인의 권리와 행사 방법">
        <P>이용자는 언제든지 아래 권리를 행사할 수 있습니다.</P>
        <Ul>
          <li>개인정보의 열람·정정·삭제 요청</li>
          <li>개인정보 처리의 정지 요청</li>
          <li>회원 탈퇴(앱 내 “설정 → 계정 → 계정 삭제”에서 즉시 처리)</li>
        </Ul>
        <P>
          앱 내 로그인이 불가한 경우 별도 안내 페이지(/account-deletion)의 양식 또는{' '}
          <span className="font-mono">{LEGAL.CONTACT_EMAIL}</span> 로 요청할 수 있습니다.
        </P>
      </Section>

      <Section title="8. 개인정보의 안전성 확보 조치">
        <Ul>
          <li>전송 구간 암호화(HTTPS/TLS)</li>
          <li>인증 토큰의 안전 저장(모바일: 보안 저장소, 웹: 세션 보호)</li>
          <li>접근 통제 및 권한 분리</li>
          <li>접근 기록 보관 및 위·변조 방지</li>
        </Ul>
      </Section>

      <Section title="9. 만 14세 미만 아동에 관한 사항">
        <P>
          서비스는 원칙적으로 만 14세 미만 아동의 가입을 제한합니다. 만 14세 미만임이 확인된 계정은
          이용이 제한될 수 있으며, 법정대리인의 동의 없이 수집된 정보는 즉시 삭제합니다.
        </P>
      </Section>

      <Section title="10. 개인정보 보호책임자 및 문의처">
        <P>
          개인정보 처리에 관한 문의·불만 처리·피해 구제 등은 아래 연락처로 접수해 주시기 바랍니다.
        </P>
        <Ul>
          <li>운영자: {LEGAL.OPERATOR_NAME}</li>
          <li>
            문의 이메일: <span className="font-mono">{LEGAL.CONTACT_EMAIL}</span>
          </li>
        </Ul>
        <P>
          개인정보 침해 신고는 한국인터넷진흥원(privacy.kisa.or.kr, 국번없이 118), 개인정보분쟁조정위원회,
          대검찰청, 경찰청 사이버안전국 등에 문의할 수 있습니다.
        </P>
      </Section>

      <Section title="11. 개정 안내">
        <P>
          본 방침이 변경되는 경우 서비스 공지 또는 앱 알림을 통해 사전 고지하며, 중요한 변경은 시행일
          7일 전부터 안내합니다.
        </P>
      </Section>

      <p className="text-muted-foreground mt-12 text-xs">
        본 페이지는 모바일 앱과 웹에서 함께 표시되며, 이용자는 언제든지 다시 열람할 수 있습니다.
      </p>
    </>
  );
}

