-- ─────────────────────────────────────────────────────────────
-- 영업이익(DS) 설정값 공유 기능
-- - app_shared_settings: 누구든 입력하면 갱신되는 전역 공유값 (비로그인 사용자용 기본값)
-- - salary_users.preferred_profit: 로그인 사용자 본인의 마지막 저장값 (전역값보다 우선)
-- 클라이언트가 직접 접근하지 않고 Vercel API Route(service role)를 통해서만 접근합니다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.app_shared_settings (
  key text primary key,
  value_num numeric,
  updated_at timestamptz not null default now()
);

alter table public.app_shared_settings enable row level security;

alter table public.salary_users add column if not exists preferred_profit numeric;
alter table public.salary_users add column if not exists preferred_profit_updated_at timestamptz;

-- 이 SQL만 Supabase SQL Editor에서 실행하면 기존 스키마에 이어서 적용됩니다.
