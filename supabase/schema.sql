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
