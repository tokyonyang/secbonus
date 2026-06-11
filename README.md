# 성과급 계산기 Vercel 버전

기존 단일 HTML 계산기를 Vercel + Next.js 프로젝트로 감싼 버전입니다.

## 포함 기능

- `/calculator.html`: 기존 계산기 화면
- `/api/stock/current`: 삼성전자 현재가 API 중계
- `/api/stock/vwap`: 삼성전자 기준주가/VWAP API 중계
- `/api/comments`: Supabase 문의게시판 등록/조회
- `/api/comments/[id]`: 관리자 키 기반 문의 삭제

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Vercel Project Settings > Environment Variables에 아래 추가
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_DELETE_KEY`

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 업로드
2. Vercel에서 Import
3. Framework Preset: Next.js
4. Environment Variables 입력
5. Deploy

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하면 `/calculator.html`로 이동합니다.
