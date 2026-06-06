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

-- RLS 활성화 + 정책 없음(deny-all): anon/authenticated 직접 접근 차단.
-- 모든 DB 접근은 API Route(service_role, RLS 우회) 경유. 클라이언트 직접 호출 금지.
alter table rooms enable row level security;

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

alter table account_deletion_requests enable row level security;

-- 앱 내 인증된 탈퇴: 유예 기간(기본 6개월) 동안 보류했다가 경과 시 완전 삭제.
-- 유예 기간 내 재로그인하면 행을 제거해 계정을 복구한다.
-- 완전 삭제 시 auth 계정 제거 + rooms.user_id_a/b null + 닉네임 익명화(주장 텍스트는 상대방 위해 보존).
create table if not exists pending_account_deletions (
  user_id       uuid         primary key,
  email         text,
  scheduled_at  timestamptz  not null,   -- 이 시각 이후 완전 삭제 대상
  requested_at  timestamptz  not null default now()
);

create index if not exists pending_account_deletions_scheduled_idx
  on pending_account_deletions (scheduled_at);

alter table pending_account_deletions enable row level security;

-- 사용자 신고 (UGC 콘텐츠/사용자 신고 — Apple Guideline 1.2)
-- 운영자는 status='pending' 건을 24시간 내 검토한다.
create table if not exists reports (
  id                uuid         primary key default gen_random_uuid(),
  room_code         varchar(6),
  reported_side     text,                                  -- 'A' | 'B' (신고당한 쪽)
  reported_user_id  uuid,                                  -- 방에서 파악되면 채움
  reporter_user_id  uuid,                                  -- 신고자 (로그인 사용자)
  reason            text         not null,                 -- abuse | hate | defamation | spam | inappropriate | etc
  detail            text,
  status            text         not null default 'pending', -- pending | reviewed | actioned | dismissed
  created_at        timestamptz  not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       text,
  note              text
);

create index if not exists reports_status_idx on reports (status, created_at desc);

alter table reports enable row level security;

-- 푸시 알림 토큰 (Expo push token). 사용자당 여러 기기 가능.
create table if not exists push_tokens (
  token       text         primary key,
  user_id     uuid         not null,
  platform    text,
  updated_at  timestamptz  not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

-- 원격 설정(공지/문의 등). 코드 재배포 없이 값만 바꾼다.
-- 예: ('notice','점검 안내...'), ('notice_active','true'), ('contact_email','...')
create table if not exists app_config (
  key         text         primary key,
  value       text,
  updated_at  timestamptz  not null default now()
);

alter table app_config enable row level security;
