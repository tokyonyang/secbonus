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

function calcPsuBasePrice(stockData: Bar[]) {
  if (!stockData.length) return null;

  const latestDate = new Date(stockData[stockData.length - 1].date);

  const oneWeekAgo = new Date(latestDate);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const oneMonthAgo = new Date(latestDate);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const twoMonthsAgo = new Date(latestDate);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const oneWeekVWAP = calculateVWAPForPeriod(stockData, oneWeekAgo.getTime());
  const oneMonthVWAP = calculateVWAPForPeriod(stockData, oneMonthAgo.getTime());
  const twoMonthVWAP = calculateVWAPForPeriod(stockData, twoMonthsAgo.getTime());

  if (!oneWeekVWAP || !oneMonthVWAP || !twoMonthVWAP) return null;

  const basePrice = Math.round((oneWeekVWAP + oneMonthVWAP + twoMonthVWAP) / 3);

  return {
    vwap: basePrice,
    oneWeekVWAP: Math.round(oneWeekVWAP),
    oneMonthVWAP: Math.round(oneMonthVWAP),
    twoMonthVWAP: Math.round(twoMonthVWAP),
  };
}

export async function GET() {
  try {
    // PSU 기준주가 산식과 동일하게 Yahoo Finance 일봉 데이터만 사용합니다.
    // 기준주가 = (1주 VWAP + 1개월 VWAP + 2개월 VWAP) / 3
    const yahoo = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/005930.KS?interval=1d&range=3mo', {
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!yahoo.ok) throw new Error('Yahoo Finance 응답 실패');

    const data = await yahoo.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quotes = result?.indicators?.quote?.[0] ?? {};

    const stockData: Bar[] = timestamps
      .map((ts: number, i: number) => ({
        date: ts * 1000,
        close: quotes.close?.[i] ?? 0,
        volume: quotes.volume?.[i] ?? 0,
      }))
      .filter((d: Bar) => d.close > 0 && d.volume > 0)
      .sort((a: Bar, b: Bar) => a.date - b.date);

    const calculated = calcPsuBasePrice(stockData);
    if (!calculated) throw new Error('VWAP 데이터 없음');

    return NextResponse.json({
      symbol: '005930.KS',
      ...calculated,
      source: 'yahoo',
      formula: '(1주 VWAP + 1개월 VWAP + 2개월 VWAP) / 3',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'VWAP 조회 실패' }, { status: 502 });
  }
}
