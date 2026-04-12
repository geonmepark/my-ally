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
