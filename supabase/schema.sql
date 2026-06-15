create extension if not exists pgcrypto;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  nick text not null,
  title text not null,
  text text not null,
  contact text,
  status text not null default '대기',
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

-- 클라이언트가 직접 DB를 호출하지 않고 Vercel API Route의 service role만 접근합니다.
-- 그래서 RLS 정책은 만들지 않아도 됩니다.
create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 개인별 연봉정보 저장용 별도 테이블
-- 클라이언트가 직접 접근하지 않고 Vercel API Route(service role)를 통해서만 접근합니다.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.salary_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  display_name text not null,
  password_salt text not null,
  password_hash text not null,
  recovery_salt text,
  recovery_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.salary_users(id) on delete cascade,
  year int not null check (year >= 2011),
  cl text not null default 'CL23',
  division text not null default 'memory',
  contract_salary_man numeric not null check (contract_salary_man >= 0),
  base_up_raise_rate numeric not null default 0,
  performance_raise_rate numeric not null default 0,
  raise_rate numeric not null default 0,
  business_performance_bonus_man numeric not null default 0,
  withholding_income_man numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_records_user_year_unique unique (user_id, year)
);

alter table public.salary_users enable row level security;
alter table public.salary_records enable row level security;

create index if not exists salary_users_login_id_idx on public.salary_users (login_id);
create index if not exists salary_records_user_year_idx on public.salary_records (user_id, year desc);




-- 기존에 salary_records 테이블을 이미 만든 경우, 2025년 이전 연봉 수기 저장을 위해 연도 제한을 2011년부터 저장 가능하도록 맞춥니다.
alter table public.salary_records drop constraint if exists salary_records_year_check;
alter table public.salary_records add constraint salary_records_year_check check (year >= 2011);

-- 기존에 salary_records 테이블을 이미 만든 경우, 임금인상률 세부 저장용 컬럼을 추가합니다.
alter table public.salary_records add column if not exists base_up_raise_rate numeric not null default 0;
alter table public.salary_records add column if not exists performance_raise_rate numeric not null default 0;

-- 기존에 salary_users 테이블을 이미 만든 경우, 아이디/비밀번호 찾기용 컬럼을 추가합니다.
alter table public.salary_users add column if not exists recovery_salt text;
alter table public.salary_users add column if not exists recovery_hash text;

-- 사용자 등록리스트 및 개인 연봉정보 전체 초기화가 필요할 때 Supabase SQL Editor에서 아래 한 줄만 실행하세요.
-- truncate table public.salary_users cascade;
