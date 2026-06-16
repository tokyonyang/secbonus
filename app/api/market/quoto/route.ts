import { NextResponse } from 'next/server';

export const revalidate = 60;

type QuotePayload = {
  type: 'stock';
  symbol: string;
  name: string;
  market?: string;
  price: number;
  change: number;
  changeRate: number;
  source: string;
  updatedAt: string;
};

function toNumber(value: unknown) {
  const n = Number(String(value ?? '').replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function signedNumber(value: unknown) {
  const raw = String(value ?? '').replace(/,/g, '').trim();
  const n = Number(raw.replace(/[+%]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cleanQuery(value: string | null) {
  return String(value ?? '').trim().replace(/\.KS$|\.KQ$/i, '').slice(0, 60);
}

function pickFirstStock(obj: any): { symbol: string; name?: string; market?: string } | null {
  const seen = new Set<any>();
  const stack = [obj];
  while (stack.length) {
    const cur = stack.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);

    const code = String(cur.itemCode ?? cur.stockCode ?? cur.symbolCode ?? cur.code ?? cur.reutersCode ?? '').trim().replace(/\.KS$|\.KQ$/i, '');
    const name = String(cur.stockName ?? cur.itemName ?? cur.name ?? cur.koreanName ?? cur.nameKo ?? '').trim();
    if (/^\d{6}$/.test(code)) {
      return {
        symbol: code,
        name: name || undefined,
        market: String(cur.marketType ?? cur.market ?? cur.exchange ?? '').trim() || undefined,
      };
    }
    for (const value of Object.values(cur)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

async function resolveSymbol(query: string) {
  const q = cleanQuery(query);
  if (/^\d{6}$/.test(q)) return { symbol: q, name: q };

  const search = await fetch(`https://m.stock.naver.com/api/search/all?keyword=${encodeURIComponent(q)}`, { next: { revalidate: 60 } });
  if (search.ok) {
    const data = await search.json();
    const found = pickFirstStock(data);
    if (found?.symbol) return { symbol: found.symbol, name: found.name || q, market: found.market };
  }
  throw new Error('검색된 국내 종목이 없습니다. 종목명 또는 6자리 종목코드를 입력해주세요.');
}

async function quoteFromNaver(symbol: string, fallbackName?: string, fallbackMarket?: string): Promise<QuotePayload | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/basic`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    const price = toNumber(data?.closePrice ?? data?.nowPrice ?? data?.stockPrice?.closePrice);
    if (!price || price <= 0) return null;
    const change = signedNumber(data?.compareToPreviousClosePrice ?? data?.compareToPreviousPrice ?? data?.changePrice);
    const changeRate = signedNumber(data?.fluctuationsRatio ?? data?.compareToPreviousClosePriceRate ?? data?.changeRate);
    return {
      type: 'stock',
      symbol,
      name: String(data?.stockName ?? data?.name ?? fallbackName ?? symbol),
      market: String(data?.stockExchangeType?.name ?? data?.marketType ?? fallbackMarket ?? '').trim() || undefined,
      price,
      change,
      changeRate,
      source: 'naver',
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function quoteFromYahoo(symbol: string, fallbackName?: string): Promise<QuotePayload> {
  const candidates = [`${symbol}.KS`, `${symbol}.KQ`];
  for (const yahooSymbol of candidates) {
    try {
      const yahoo = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`, { next: { revalidate: 60 } });
      if (!yahoo.ok) continue;
      const data = await yahoo.json();
      const result = data?.chart?.result?.[0];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const validCloses = closes.filter((v: unknown) => Number.isFinite(Number(v))).map(Number);
      const price = validCloses.slice(-1)[0];
      const prev = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : price;
      if (!price || price <= 0) continue;
      const change = price - prev;
      const changeRate = prev ? (change / prev) * 100 : 0;
      return {
        type: 'stock',
        symbol,
        name: fallbackName || symbol,
        market: yahooSymbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI',
        price: Math.round(price),
        change: Math.round(change),
        changeRate: Math.round(changeRate * 100) / 100,
        source: 'yahoo',
        updatedAt: new Date().toISOString(),
      };
    } catch {}
  }
  throw new Error('종목 현재가 조회에 실패했습니다.');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = cleanQuery(searchParams.get('query') || searchParams.get('symbol'));
    if (!query) return NextResponse.json({ error: '종목명 또는 종목코드를 입력해주세요.' }, { status: 400 });
    const resolved = await resolveSymbol(query);
    const naverQuote = await quoteFromNaver(resolved.symbol, resolved.name, resolved.market);
    if (naverQuote) return NextResponse.json(naverQuote);
    return NextResponse.json(await quoteFromYahoo(resolved.symbol, resolved.name));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '종목 조회 실패' }, { status: 502 });
  }
}
