import { NextResponse } from 'next/server';

export const revalidate = 300;

type Bar = { date: number; close: number; volume: number };

function calculateVWAPForPeriod(data: Bar[], targetDateMs: number) {
  const filtered = data.filter(d => d.date >= targetDateMs && d.close > 0 && d.volume > 0);
  if (!filtered.length) return 0;
  const totalPV = filtered.reduce((sum, d) => sum + d.close * d.volume, 0);
  const totalVolume = filtered.reduce((sum, d) => sum + d.volume, 0);
  return totalVolume > 0 ? totalPV / totalVolume : 0;
}

function calcFinalVwap(stockData: Bar[]) {
  if (!stockData.length) return null;
  const latestDate = new Date(stockData[stockData.length - 1].date);
  const oneWeekAgo = new Date(latestDate); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneMonthAgo = new Date(latestDate); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const twoMonthsAgo = new Date(latestDate); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const values = [oneWeekAgo, oneMonthAgo, twoMonthsAgo].map(d => calculateVWAPForPeriod(stockData, d.getTime())).filter(Boolean);
  if (!values.length) return null;
  return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
}

export async function GET() {
  try {
    // 1차: 네이버 일봉 XML
    try {
      const res = await fetch('https://fchart.stock.naver.com/sise.nhn?symbol=005930&timeframe=day&count=60&requestType=0', { next: { revalidate: 300 } });
      if (res.ok) {
        const text = await res.text();
        const stockData: Bar[] = [...text.matchAll(/data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|(\d+)\|(\d+)"/g)].map(m => {
          const ds = m[1];
          return {
            date: new Date(Number(ds.slice(0,4)), Number(ds.slice(4,6))-1, Number(ds.slice(6,8))).getTime(),
            close: Number(m[2]),
            volume: Number(m[3]),
          };
        });
        const vwap = calcFinalVwap(stockData);
        if (vwap) return NextResponse.json({ symbol: '005930', vwap, source: 'naver', updatedAt: new Date().toISOString() });
      }
    } catch {}

    // 2차: Yahoo Finance 3개월 일봉
    const yahoo = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/005930.KS?interval=1d&range=3mo', { next: { revalidate: 300 } });
    if (!yahoo.ok) throw new Error('Yahoo Finance 응답 실패');
    const data = await yahoo.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quotes = result?.indicators?.quote?.[0] ?? {};
    const stockData: Bar[] = timestamps.map((ts: number, i: number) => ({
      date: ts * 1000,
      close: quotes.close?.[i] ?? 0,
      volume: quotes.volume?.[i] ?? 0,
    })).filter((d: Bar) => d.close > 0 && d.volume > 0);
    const vwap = calcFinalVwap(stockData);
    if (!vwap) throw new Error('VWAP 데이터 없음');
    return NextResponse.json({ symbol: '005930.KS', vwap, source: 'yahoo', updatedAt: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'VWAP 조회 실패' }, { status: 502 });
  }
}
