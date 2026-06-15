성과급 계산기 웹 배포용 파일

1) Netlify 사용 시
- https://app.netlify.com/drop 접속
- 이 ZIP 파일의 압축을 풀고 bonus-calculator-web 폴더를 드래그 앤 드롭
- 생성된 URL로 접속

2) Vercel 사용 시
- GitHub 저장소에 index.html 업로드
- Vercel에서 해당 저장소 Import
- Framework Preset은 Other 선택
- Build Command는 비워두고 Deploy

주의: 이 파일은 React/ReactDOM/Babel CDN을 사용하므로 접속 환경에서 외부 CDN 접근이 가능해야 정상 작동합니다.
