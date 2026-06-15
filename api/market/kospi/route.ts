import { NextResponse } from 'next/server';

export const revalidate = 60;

type KospiPayload = {
  price: number;
  change: number;
  changeRate: number;
  source: string;
  updatedAt: string;
};

function toNumber(value: unknown) {
  const n = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(n) ? n : null;
}

function signedNumber(value: unknown) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  const n = Number(raw.replace(/[+%]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  try {
    // 1차: 네이버 모바일 증권 지수 API
    try {
      const naver = await fetch('https://m.stock.naver.com/api/index/KOSPI/basic', { next: { revalidate: 60 } });
      if (naver.ok) {
        const data = await naver.json();
        const price = toNumber(data?.closePrice ?? data?.nowPrice ?? data?.price);
        if (price && price > 0) {
          const change = signedNumber(data?.compareToPreviousClosePrice ?? data?.compareToPreviousPrice ?? data?.changePrice);
          const changeRate = signedNumber(data?.fluctuationsRatio ?? data?.compareToPreviousClosePriceRate ?? data?.changeRate);
          const payload: KospiPayload = {
            price,
            change,
            changeRate,
            source: 'naver',
            updatedAt: new Date().toISOString(),
          };
          return NextResponse.json(payload);
        }
      }
    } catch {}

    // 2차: Yahoo Finance KOSPI(^KS11)
    const yahoo = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?interval=1d&range=5d', { next: { revalidate: 60 } });
    if (!yahoo.ok) throw new Error('Yahoo Finance 응답 실패');
    const data = await yahoo.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((v: unknown) => Number.isFinite(Number(v))).map(Number);
    const price = validCloses.slice(-1)[0];
    const prev = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : price;
    if (!price || price <= 0) throw new Error('KOSPI 데이터 없음');
    const change = price - prev;
    const changeRate = prev ? (change / prev) * 100 : 0;
    const payload: KospiPayload = {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changeRate: Math.round(changeRate * 100) / 100,
      source: 'yahoo',
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'KOSPI 조회 실패' }, { status: 502 });
  }
}
