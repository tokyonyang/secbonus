import { NextResponse } from 'next/server';

export const revalidate = 60;

function toNumber(value: unknown) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET() {
  try {
    // 1차: 네이버 모바일 주식 API
    try {
      const res = await fetch('https://m.stock.naver.com/api/stock/005930/basic', { next: { revalidate: 60 } });
      if (res.ok) {
        const data = await res.json();
        const price = toNumber(data?.closePrice ?? data?.stockPrice?.closePrice);
        if (price) return NextResponse.json({ symbol: '005930', price, source: 'naver', updatedAt: new Date().toISOString() });
      }
    } catch {}

    // 2차: Yahoo Finance
    const yahoo = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/005930.KS?interval=1d&range=5d', { next: { revalidate: 60 } });
    if (!yahoo.ok) throw new Error('Yahoo Finance 응답 실패');
    const data = await yahoo.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const price = closes.filter(Boolean).slice(-1)[0];
    if (!price) throw new Error('현재가 데이터 없음');
    return NextResponse.json({ symbol: '005930.KS', price: Math.round(price), source: 'yahoo', updatedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '현재가 조회 실패' }, { status: 502 });
  }
}
