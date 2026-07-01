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
  -- 판사 모델 ('gemini' | 'claude')
  judge           text,
  -- 재심(불복)
  appeal_by       text,        -- 재심 신청한 쪽 ('A' | 'B')
  appeal_text     text,        -- 재심 신청 내용
  winner_note     text,        -- 이긴 쪽 추가 의견
  retrial_done    boolean      not null default false,
  -- 참여자 식별(로그인 사용자). 완전 삭제 시 null 처리.
  user_id_a       uuid,
  user_id_b       uuid,
  -- 입장 시점 프로필 아바타 스냅샷(이후 프로필 변경/탈퇴와 무관하게 방 기록 보존)
  avatar_a        text,
  avatar_b        text,
  created_at      bigint       not null
);

-- 기존 DB 보강(idempotent). 위 create는 신규 환경용, 아래는 이미 생성된 테이블용.
alter table rooms add column if not exists judge        text;
alter table rooms add column if not exists appeal_by    text;
alter table rooms add column if not exists appeal_text  text;
alter table rooms add column if not exists winner_note  text;
alter table rooms add column if not exists retrial_done boolean not null default false;
alter table rooms add column if not exists user_id_a    uuid;
alter table rooms add column if not exists user_id_b    uuid;
alter table rooms add column if not exists avatar_a     text;
alter table rooms add column if not exists avatar_b     text;

-- RLS 활성화 + 정책 없음(deny-all): anon/authenticated 직접 접근 차단.
-- 모든 DB 접근은 API Route(service_role, RLS 우회) 경유. 클라이언트 직접 호출 금지.
alter table rooms enable row level security;

-- 사용자 프로필 (SNS형 이름 + 아바타). 가입 시 SNS 메타데이터로 lazy-seed.
-- display_name: 표시 이름(≤20자), 1일 1회만 변경(name_changed_at 기준 API에서 판정).
-- avatar_url: Storage 'avatars' 버킷 public URL (nullable).
-- 모든 접근은 API Route(service_role) 경유 — rooms와 동일하게 deny-all.
create table if not exists profiles (
  user_id         uuid         primary key,
  display_name    text         not null,
  avatar_url      text,
  name_changed_at timestamptz,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

alter table profiles enable row level security;

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

-- 프로필 아바타 Storage 버킷 'avatars' (public read).
-- 아바타 바이너리는 클라이언트가 본인 세션으로 직접 업로드(profiles 테이블 쓰기는 API 경유).
-- 경로 규칙: '{user_id}/...' — 본인 폴더에만 쓰기 허용.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 누구나 읽기(공개). (create policy는 IF NOT EXISTS 미지원 → drop 후 생성)
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- 인증 사용자는 본인 폴더에만 업로드/수정/삭제
drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
