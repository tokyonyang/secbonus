export const metadata = {
  title: '성과급 계산기',
  description: '삼성전자 DS부문 성과급 계산기',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: '#070b13' }}>{children}</body>
    </html>
  );
}
