# 컨센서스 DB 연동 변경 내역 (secbonus, 브랜치 `consensus-db`)

- 기준 커밋: `b4c1ff7` (main, PR #2 머지 완료)
- 작업일: 2026-11-10, 로컬 클론 `~/workspace/secbonus-work`에서만 수행. **푸시·PR·머지 없음.**
- 범위: 공유 영업이익 버그 수정 + 증권사 컨센서스 프리셋의 DB 연동. 계산식·세율·프리셋 숫자는 바꾸지 않았다. P1/P2는 손대지 않았다.

## 0. 원인 — 왜 공유 영업이익이 "마지막 방문자의 슬라이더 값"이 됐나

`calculator.html`에 두 개의 effect가 있었다.

1. 마운트 시 `GET /api/settings/profit`을 불러와 `setProfit(전역값)` — 전역값이 컨센서스 프리셋(DS 370조)을 덮었다.
2. `profit`이 바뀔 때마다 900ms 디바운스로 `POST /api/settings/profit` — `app/api/settings/profit/route.ts`의 POST는 로그인 여부와 무관하게 전역 `app_shared_settings` 행(key='profit')을 무조건 upsert했고, 로그인 사용자는 `salary_users.preferred_profit`에도 같은 값을 썼다.

즉 전역 기본값은 "가장 최근에 슬라이더를 움직인 방문자의 값"이었고, 그 값이 다음 방문자 모두의 첫 화면을 덮었다. 이 두 effect가 버그의 전부다.

## 1. 바꾼 것

| 파일 | 변경 |
|---|---|
| `supabase/schema_addition_consensus.sql` (신규) | `app_shared_settings`에 `value_json jsonb` 컬럼 추가. key='consensus' 행에 프리셋 JSON을 저장한다. Supabase SQL Editor에서 한 번 실행하는 마이그레이션 문서다. |
| `app/api/settings/consensus/route.ts` (신규) | GET/POST. 아래 §2 참고. |
| `calculator.html` (+ `public/calculator.html` 바이트 동일 동기화) | 하드코딩 `SCENARIOS` → `SCENARIOS_BUILTIN`으로 이름 변경, `scenarios`/`scenarioSource`/`scenarioUpdatedAt`/`dispersionNote` state 추가. `applyScenario`·`activeScenario`·프리셋 버튼이 state를 본다. 공유 영업이익 GET/POST effect 2개와 `sharedProfitLoaded` ref 삭제. 마운트 1회용 컨센서스 로드 effect 추가. 결과 배너에 "기준: DB 설정 기준 · 업데이트: YYYY-MM-DD" 또는 "기본값(코드 내장)" 한 줄 추가. |
| `app/api/settings/profit/route.ts` | 동작 변경 없음. 헤더 주석만 추가 (자동 POST 삭제 경위 + 전역 profit 행은 이제 consensus POST에서 동기화 + 하위 호환 유지). |

## 2. 새 API — `/api/settings/consensus`

- `GET`: `app_shared_settings` key='consensus' 행의 `value_json`을 읽는다.
  - 유효한 행이 있으면 `{source:'db', updatedAt, scenarios, defaultScenarioId, dispersionNote}` 반환.
  - 행이 없으면 내장 기본값을 한 번 심어두고 `{source:'seeded', ...}` 반환. 심기 실패(컬럼 미마이그레이션 등) 시 `{source:'builtin', ...}`.
  - 형식이 깨진 저장값은 무시하고 builtin 반환 (덮어쓰지 않음).
  - **어떤 오류에서도 HTTP 200 + 내장 기본값**을 반환한다. 이 엔드포인트 때문에 계산기가 깨지지 않는다.
  - 유효성 검사(서버·클라이언트 동일): `scenarios` 객체, `consensus` 항목 필수, 각 항목 `dsProfitJo`/`totalProfitJo`는 유한한 숫자, `source`/`asOf`는 문자열, `defaultScenarioId`가 scenarios 안에 존재.
- `POST`: 관리자 전용. `x-admin-key` 헤더가 `ADMIN_DELETE_KEY` 환경변수와 일치해야 한다 (패턴은 `app/api/salary/admin-reset/route.ts`와 동일). 키 미설정 시 503, 불일치 시 401, 형식 오류 시 400. 성공 시 key='consensus'에 `value_json`을 upsert하고, 하위 호환으로 key='profit' 행도 `value_num` = consensus 시나리오의 DS 영업이익으로 함께 upsert한다. `{ok:true}` 반환.

## 3. 한 번만 실행할 SQL (Supabase SQL Editor)

```sql
-- supabase/schema_addition_consensus.sql 내용 그대로 실행
alter table public.app_shared_settings
  add column if not exists value_json jsonb;
```

이 SQL을 실행하기 전에도 사이트는 내장 기본값으로 정상 동작한다. 실행 후 첫 GET 때 기본값이 DB에 심어진다(`source:'seeded'`).

## 4. 이후 컨센서스 업데이트 방법 (관리자만)

### 방법 A — Supabase SQL Editor (권장, 간단)

```sql
update public.app_shared_settings
set value_json = '{
  "scenarios": {
    "conservative": {"id":"conservative","label":"보수적 · 기존 기본값","dsProfitJo":50,"totalProfitJo":65,"source":"기존 사이트 기본값, 2025년 DS 실적 43.6조 기준","asOf":"2026-11-10 확인"},
    "consensus": {"id":"consensus","label":"기본 · 컨센서스","dsProfitJo":370,"totalProfitJo":372,"source":"FnGuide 컨센서스 전사 371.7조(2026-10-26) + DS 약 370조 추산","asOf":"2026-10-26"},
    "optimistic": {"id":"optimistic","label":"낙관","dsProfitJo":390,"totalProfitJo":400,"source":"키움증권 DS 2026E 약 390조 표기","asOf":"2026-10-30 보고서 기준"}
  },
  "defaultScenarioId": "consensus",
  "dispersionNote": "증권사별 편차 큼: KB DS 208조 ~ 키움 DS 390조"
}'::jsonb,
updated_at = now()
where key = 'consensus';
```

행이 없으면 위 `update`는 0건을 바꾸므로, 그때는 `insert ... on conflict (key) do update`로 넣는다. 숫자·출처·기준일만 바꾸면 되고, `profit` 행은 방법 B를 쓰지 않는 한 따로 맞출 필요가 있다(방법 A는 `profit` 행을 건드리지 않는다 — 계산기는 consensus 값을 쓰므로 실동작에는 영향이 없다).

### 방법 B — curl (관리자 키 필요, `profit` 행도 함께 동기화됨)

```bash
curl -X POST https://secbonus.vercel.app/api/settings/consensus \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: <ADMIN_DELETE_KEY>' \
  -d '{"scenarios":{"conservative":{"id":"conservative","label":"보수적 · 기존 기본값","dsProfitJo":50,"totalProfitJo":65,"source":"기존 사이트 기본값, 2025년 DS 실적 43.6조 기준","asOf":"2026-11-10 확인"},"consensus":{"id":"consensus","label":"기본 · 컨센서스","dsProfitJo":370,"totalProfitJo":372,"source":"FnGuide 컨센서스 전사 371.7조(2026-10-26) + DS 약 370조 추산","asOf":"2026-10-26"},"optimistic":{"id":"optimistic","label":"낙관","dsProfitJo":390,"totalProfitJo":400,"source":"키움증권 DS 2026E 약 390조 표기","asOf":"2026-10-30 보고서 기준"}},"defaultScenarioId":"consensus","dispersionNote":"증권사별 편차 큼: KB DS 208조 ~ 키움 DS 390조"}'
```

`ADMIN_DELETE_KEY`는 Vercel 환경변수에 이미 있는 값(댓글 삭제·연봉 초기화와 공용)을 쓴다. 키를 모르면 방법 A를 쓰면 된다.

## 5. 폴백 동작

| 상황 | 동작 |
|---|---|
| DB에 consensus 행 있음(유효) | DB 값 사용, 배너에 "DB 설정 기준 · 업데이트: YYYY-MM-DD" 표시 |
| 행 없음 | 첫 GET 때 기본값을 심고 사용 (`seeded`) |
| `value_json` 컬럼 없음 / Supabase env 없음 / API 오류 | 내장 기본값 사용, 배너에 "기본값(코드 내장)" 표시. 계산기는 정상 동작 |
| 저장값 형식 깨짐 | 내장 기본값 사용 (깨진 값을 덮어쓰지 않음) |
| 사용자가 슬라이더를 움직임 | 자기 화면에서만 바뀐다. 서버에 자동 저장되지 않는다 |

## 6. 반자동 컨센서스 체크 (코드가 아니라 운영)

분기별(실적 시즌 후) 어시스턴트가 최신 컨센서스를 찾아 새 프리셋 값 + 출처·기준일을 제안하고, 사용자가 승인한 뒤에만 §4 방법으로 반영한다. 자동 수집·자동 반영은 하지 않는다. 이 작업은 이 저장소의 코드가 아니라 별도 스케줄 작업으로 관리한다.

## 검증 결과 (2026-11-10, 로컬)

- `setProfit(` 호출: 2곳만 남음 — `applyScenario`(1974행)와 컨센서스 로드 effect(3118행). 구 공유 설정 effect의 `setProfit`은 사라졌다.
- `fetch('/api/settings/profit'` : calculator.html에서 0건 (삭제 경위 설명 주석 2건에만 이름이 남아 있음).
- `SCENARIOS_BUILTIN` 정의 1개, `Object.values(scenarios)` 1곳(프리셋 버튼), `activeScenario = scenarios[...]` 1곳, `dispersionNote` state 사용 2곳(결과 배너·설정 탭).
- `sharedProfitLoaded` 0건.
- `cmp calculator.html public/calculator.html`: 바이트 동일.
- 괄호 균형: `{`/`}` 4473/4473, `[`/`]` 382/382, `(`/`)` 4069/4071 (2개 차이는 패치 전에도 동일했던 텍스트 안 괄호 패턴).
- 로컬 dev 서버(`npm run dev`, 포트 3101): `/calculator.html` 200 (520,317바이트), 서빙본 안에 `SCENARIOS_BUILTIN` 4회, `/api/settings/consensus` 3회, `DB 설정 기준` 1회 확인.
- `GET /api/settings/consensus` (Supabase env 없음): HTTP 200, `{source:'builtin', ...기본 프리셋(DS 370/전사 372)...}` 반환 — 폴백 동작 확인.
- `POST /api/settings/consensus`: 키 미설정 시 503, `ADMIN_DELETE_KEY=testkey123`으로 띄운 서버에서 잘못된 키 → 401 "관리자 키가 올바르지 않습니다.", 올바른 키 + 형식 오류 본문 → 400, 올바른 키 + 유효 본문 → 500 (Supabase env 없음 — 로컬에서만 나는 오류, Vercel에서는 upsert 수행).
- `npx tsc --noEmit`: exit 0, 오류 없음.

### 검증 중 발견해 고친 것

- 새 라우트의 import 경로를 처음에 `'../../../_lib/supabase'`로 잘못 썼다. `app/api/settings/profit/route.ts`와 같은 깊이이므로 `'../../_lib/supabase'`가 맞다. 처음에는 `GET /api/settings/consensus`이 500을 냈고, dev 로그의 `Module not found`로 원인을 확인해 고친 뒤 200을 확인했다.

### 미검증 (로컬에서 할 수 없음)

- Supabase가 있는 환경에서의 실제 DB 읽기/쓰기 (GET `source:'db'`/`'seeded'`, POST upsert + `profit` 행 동기화). Vercel 배포 후 확인 필요.
- `value_json` 컬럼 마이그레이션 SQL 실행 전에는 `seeded` 경로를 타지 않고 `builtin`으로 떨어지는 것만 로컬에서 확인했다.
