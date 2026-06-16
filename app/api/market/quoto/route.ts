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

const JSON_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
  accept: 'application/json,text/plain,*/*',
  referer: 'https://m.stock.naver.com/',
};

const COMMON_STOCKS: Record<string, { symbol: string; name: string; market?: string }> = {
  '삼성전자': { symbol: '005930', name: '삼성전자', market: 'KOSPI' },
  '삼전': { symbol: '005930', name: '삼성전자', market: 'KOSPI' },
  '삼성전자우': { symbol: '005935', name: '삼성전자우', market: 'KOSPI' },
  'sk하이닉스': { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  '하이닉스': { symbol: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  '현대차': { symbol: '005380', name: '현대차', market: 'KOSPI' },
  '기아': { symbol: '000270', name: '기아', market: 'KOSPI' },
  'naver': { symbol: '035420', name: 'NAVER', market: 'KOSPI' },
  '네이버': { symbol: '035420', name: 'NAVER', market: 'KOSPI' },
  '카카오': { symbol: '035720', name: '카카오', market: 'KOSPI' },
  'lg에너지솔루션': { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  'lg화학': { symbol: '051910', name: 'LG화학', market: 'KOSPI' },
  '셀트리온': { symbol: '068270', name: '셀트리온', market: 'KOSPI' },
  '한화에어로스페이스': { symbol: '012450', name: '한화에어로스페이스', market: 'KOSPI' },
  '두산에너빌리티': { symbol: '034020', name: '두산에너빌리티', market: 'KOSPI' },
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

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, '').replace(/㈜|\(주\)|주식회사/g, '').trim();
}

function pickFirstStock(obj: any): { symbol: string; name?: string; market?: string } | null {
  const seen = new Set<any>();
  const stack = [obj];
  while (stack.length) {
    const cur = stack.shift();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);

    const code = String(
      cur.itemCode ?? cur.stockCode ?? cur.symbolCode ?? cur.code ?? cur.reutersCode ?? cur.cd ?? cur.ticker ?? cur.itemcode ?? ''
    ).trim().replace(/\.KS$|\.KQ$/i, '');
    const name = String(
      cur.stockName ?? cur.itemName ?? cur.name ?? cur.koreanName ?? cur.nameKo ?? cur.nm ?? cur.hname ?? cur.companyName ?? ''
    ).trim();
    const market = String(cur.marketType ?? cur.market ?? cur.exchange ?? cur.typeCode ?? cur.nationType ?? '').trim();
    if (/^\d{6}$/.test(code)) return { symbol: code, name: name || undefined, market: market || undefined };

    for (const value of Object.values(cur)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: JSON_HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function resolveSymbol(query: string) {
  const q = cleanQuery(query);
  if (/^\d{6}$/.test(q)) return { symbol: q, name: q };

  const common = COMMON_STOCKS[normalizeKey(q)];
  if (common) return common;

  const urls = [
    `https://m.stock.naver.com/api/search/all?keyword=${encodeURIComponent(q)}`,
    `https://m.stock.naver.com/api/search/stock?keyword=${encodeURIComponent(q)}`,
    `https://ac.finance.naver.com/ac?q=${encodeURIComponent(q)}&q_enc=UTF-8&st=111&r_format=json&r_enc=UTF-8`,
  ];

  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const found = pickFirstStock(data);
      if (found?.symbol) return { symbol: found.symbol, name: found.name || q, market: found.market };
    } catch {}
  }

  throw new Error('검색된 국내 종목이 없습니다. 종목명 또는 6자리 종목코드를 입력해주세요.');
}

function quotePayloadFromBasic(data: any, symbol: string, fallbackName?: string, fallbackMarket?: string): QuotePayload | null {
  const price = toNumber(data?.closePrice ?? data?.nowPrice ?? data?.stockPrice?.closePrice ?? data?.now ?? data?.price);
  if (!price || price <= 0) return null;
  const change = signedNumber(data?.compareToPreviousClosePrice ?? data?.compareToPreviousPrice ?? data?.changePrice ?? data?.diff);
  const changeRate = signedNumber(data?.fluctuationsRatio ?? data?.compareToPreviousClosePriceRate ?? data?.changeRate ?? data?.rate);
  return {
    type: 'stock',
    symbol,
    name: String(data?.stockName ?? data?.name ?? data?.itemName ?? fallbackName ?? symbol),
    market: String(data?.stockExchangeType?.name ?? data?.marketType ?? data?.market ?? fallbackMarket ?? '').trim() || undefined,
    price,
    change,
    changeRate,
    source: 'naver',
    updatedAt: new Date().toISOString(),
  };
}

async function quoteFromNaver(symbol: string, fallbackName?: string, fallbackMarket?: string): Promise<QuotePayload | null> {
  const urls = [
    `https://m.stock.naver.com/api/stock/${symbol}/basic`,
    `https://api.finance.naver.com/service/itemSummary.naver?itemcode=${symbol}`,
  ];
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const payload = quotePayloadFromBasic(data, symbol, fallbackName, fallbackMarket);
      if (payload) return payload;
    } catch {}
  }

  try {
    const data = await fetchJson(`https://polling.finance.naver.com/api/realtime/domestic/stock/${symbol}`);
    const item = data?.datas?.[0] ?? data?.result?.areas?.[0]?.datas?.[0];
    const price = toNumber(item?.nv ?? item?.closePrice ?? item?.nowPrice);
    if (price && price > 0) {
      const change = signedNumber(item?.cv ?? item?.compareToPreviousClosePrice);
      const changeRate = signedNumber(item?.cr ?? item?.fluctuationsRatio);
      return {
        type: 'stock',
        symbol,
        name: String(item?.nm ?? item?.stockName ?? fallbackName ?? symbol),
        market: fallbackMarket || undefined,
        price,
        change,
        changeRate,
        source: 'naver-realtime',
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {}

  return null;
}

async function quoteFromYahoo(symbol: string, fallbackName?: string): Promise<QuotePayload> {
  const candidates = [`${symbol}.KS`, `${symbol}.KQ`];
  for (const yahooSymbol of candidates) {
    try {
      const yahoo = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`, { headers: JSON_HEADERS, cache: 'no-store' });
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
  throw new Error('종목 현재가 조회에 실패했습니다. 종목코드 6자리로 다시 시도해주세요.');
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
