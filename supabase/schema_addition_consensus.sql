-- ─────────────────────────────────────────────────────────────
-- 컨센서스(증권사 영업이익 전망) 설정값 저장용 컬럼
-- - app_shared_settings.value_json (jsonb): key='consensus' 행에
--   프리셋 3개(보수적/기본·컨센서스/낙관) + 기본 프리셋 + 편차 문구를
--   JSON으로 저장한다. 숫자를 바꾸면 코드 배포 없이 값만 바꾸면 된다.
-- - 이 파일은 Supabase SQL Editor에서 한 번만 실행하면 된다.
--   (컬럼이 없으면 /api/settings/consensus는 내장 기본값을 반환한다.)
-- ─────────────────────────────────────────────────────────────

alter table public.app_shared_settings
  add column if not exists value_json jsonb;

comment on column public.app_shared_settings.value_json is
  'key=consensus 행의 컨센서스 설정(JSON). app/api/settings/consensus/route.ts 참고';
