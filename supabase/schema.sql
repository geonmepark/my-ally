-- my-ally rooms 테이블
-- Supabase 대시보드 > SQL Editor에서 이 파일 내용을 붙여넣고 실행하세요.

create table if not exists rooms (
  code            varchar(6)   primary key,
  status          text         not null default 'waiting',
  nickname_a      text         not null,
  nickname_b      text,
  submission_a    text,
  submission_b    text,
  -- 논점 불일치 시 결이가 보내는 추가 질문
  clarification_a text,
  clarification_b text,
  -- 추가 질문에 대한 재제출
  resubmission_a  text,
  resubmission_b  text,
  verdict_text    text,
  winner          text,
  created_at      bigint       not null
);

-- RLS(Row Level Security) 비활성화 — API Route에서 service_role key로 접근
alter table rooms disable row level security;

-- 외부(로그인 불가) 사용자가 제출하는 계정 삭제 요청
-- 앱 내 인증된 삭제는 별도(DELETE /api/account)로 처리한다.
create table if not exists account_deletion_requests (
  id            uuid         primary key default gen_random_uuid(),
  email         text         not null,
  reason        text,
  source        text         not null default 'web',
  status        text         not null default 'pending',  -- pending | processed | rejected
  processed_at  timestamptz,
  processed_by  text,
  note          text,
  created_at    timestamptz  not null default now()
);

create index if not exists account_deletion_requests_status_idx
  on account_deletion_requests (status, created_at desc);

alter table account_deletion_requests disable row level security;
