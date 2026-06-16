import { NextResponse } from 'next/server';

export const revalidate = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  'lg에너지솔루션': { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  'lg엔솔': { symbol: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  '현대차': { symbol: '005380', name: '현대차', market: 'KOSPI' },
  '현대자동차': { symbol: '005380', name: '현대차', market: 'KOSPI' },
  '기아': { symbol: '000270', name: '기아', market: 'KOSPI' },
  'naver': { symbol: '035420', name: 'NAVER', market: 'KOSPI' },
  '네이버': { symbol: '035420', name: 'NAVER', market: 'KOSPI' },
  '카카오': { symbol: '035720', name: '카카오', market: 'KOSPI' },
  'kb금융': { symbol: '105560', name: 'KB금융', market: 'KOSPI' },
  '신한지주': { symbol: '055550', name: '신한지주', market: 'KOSPI' },
  '하나금융지주': { symbol: '086790', name: '하나금융지주', market: 'KOSPI' },
  '우리금융지주': { symbol: '316140', name: '우리금융지주', market: 'KOSPI' },
  '삼성바이오로직스': { symbol: '207940', name: '삼성바이오로직스', market: 'KOSPI' },
  '셀트리온': { symbol: '068270', name: '셀트리온', market: 'KOSPI' },
  '유한양행': { symbol: '000100', name: '유한양행', market: 'KOSPI' },
  'sk바이오팜': { symbol: '326030', name: 'SK바이오팜', market: 'KOSPI' },
  'lg화학': { symbol: '051910', name: 'LG화학', market: 'KOSPI' },
  '삼성sdi': { symbol: '006400', name: '삼성SDI', market: 'KOSPI' },
  '포스코홀딩스': { symbol: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  'posco홀딩스': { symbol: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  '포스코퓨처엠': { symbol: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  '현대모비스': { symbol: '012330', name: '현대모비스', market: 'KOSPI' },
  'lg전자': { symbol: '066570', name: 'LG전자', market: 'KOSPI' },
  '삼성전기': { symbol: '009150', name: '삼성전기', market: 'KOSPI' },
  '삼성물산': { symbol: '028260', name: '삼성물산', market: 'KOSPI' },
  '삼성생명': { symbol: '032830', name: '삼성생명', market: 'KOSPI' },
  'sk이노베이션': { symbol: '096770', name: 'SK이노베이션', market: 'KOSPI' },
  'sk텔레콤': { symbol: '017670', name: 'SK텔레콤', market: 'KOSPI' },
  'kt&g': { symbol: '033780', name: 'KT&G', market: 'KOSPI' },
  '한화에어로스페이스': { symbol: '012450', name: '한화에어로스페이스', market: 'KOSPI' },
  '두산에너빌리티': { symbol: '034020', name: '두산에너빌리티', market: 'KOSPI' },
  '두산로보틱스': { symbol: '454910', name: '두산로보틱스', market: 'KOSPI' },
  '카카오뱅크': { symbol: '323410', name: '카카오뱅크', market: 'KOSPI' },
  '크래프톤': { symbol: '259960', name: '크래프톤', market: 'KOSPI' },
  'hd현대중공업': { symbol: '329180', name: 'HD현대중공업', market: 'KOSPI' },
  '현대중공업': { symbol: '329180', name: 'HD현대중공업', market: 'KOSPI' },
  '알테오젠': { symbol: '196170', name: '알테오젠', market: 'KOSDAQ' },
  '에코프로비엠': { symbol: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  '에코프로': { symbol: '086520', name: '에코프로', market: 'KOSDAQ' },
  'hlb': { symbol: '028300', name: 'HLB', market: 'KOSDAQ' },
  '리가켐바이오': { symbol: '141080', name: '리가켐바이오', market: 'KOSDAQ' },
  '펄어비스': { symbol: '263750', name: '펄어비스', market: 'KOSDAQ' },
  '레인보우로보틱스': { symbol: '277810', name: '레인보우로보틱스', market: 'KOSDAQ' },
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

function findCommonStock(query: string) {
  const key = normalizeKey(query);
  if (COMMON_STOCKS[key]) return COMMON_STOCKS[key];
  const entries = Object.entries(COMMON_STOCKS);
  const exactName = entries.find(([, stock]) => normalizeKey(stock.name) === key);
  if (exactName) return exactName[1];
  // 2글자 이상이면 사용자가 입력한 종목명이 사전명에 포함되는 경우도 허용합니다.
  if (key.length >= 2) {
    const partial = entries.find(([alias, stock]) => normalizeKey(alias).includes(key) || normalizeKey(stock.name).includes(key));
    if (partial) return partial[1];
  }
  return null;
}

function looksLikeStockName(value: string) {
  const v = value.trim();
  if (!v || /^\d+$/.test(v)) return false;
  if (/^[A-Z0-9.]+$/.test(v) && v.length <= 4) return false;
  return /[가-힣A-Za-z]/.test(v);
}

function normalizeMarket(value?: string) {
  const v = String(value ?? '').toUpperCase();
  if (v.includes('KOSDAQ') || v.includes('코스닥') || v === 'KQ') return 'KOSDAQ';
  if (v.includes('KOSPI') || v.includes('거래소') || v.includes('유가') || v === 'KS') return 'KOSPI';
  return value || undefined;
}

function stockFromArray(values: unknown[]): { symbol: string; name?: string; market?: string } | null {
  const strings = values.map((v) => String(v ?? '').trim()).filter(Boolean);
  const codeIndex = strings.findIndex((v) => /^\d{6}$/.test(v.replace(/\.KS$|\.KQ$/i, '')));
  if (codeIndex < 0) return null;
  const symbol = strings[codeIndex].replace(/\.KS$|\.KQ$/i, '');
  const name = strings.find((v, idx) => idx !== codeIndex && looksLikeStockName(v) && !/^KOSPI|KOSDAQ|KS|KQ$/i.test(v));
  const market = strings.find((v) => /KOSPI|KOSDAQ|코스피|코스닥|거래소|유가|KS|KQ/i.test(v));
  return { symbol, name, market: normalizeMarket(market) };
}

function pickFirstStock(obj: any): { symbol: string; name?: string; market?: string } | null {
  const seen = new Set<any>();
  const stack = [obj];
  while (stack.length) {
    const cur = stack.shift();
    if (!cur || seen.has(cur)) continue;

    if (Array.isArray(cur)) {
      seen.add(cur);
      const fromArray = stockFromArray(cur);
      if (fromArray?.symbol) return fromArray;
      for (const value of cur) {
        if (Array.isArray(value) || (value && typeof value === 'object')) stack.push(value);
      }
      continue;
    }

    if (typeof cur !== 'object') continue;
    seen.add(cur);

    const code = String(
      cur.itemCode ?? cur.stockCode ?? cur.symbolCode ?? cur.code ?? cur.reutersCode ?? cur.cd ?? cur.ticker ?? cur.itemcode ?? cur.stock_code ?? cur.iscd ?? ''
    ).trim().replace(/\.KS$|\.KQ$/i, '');
    const name = String(
      cur.stockName ?? cur.itemName ?? cur.name ?? cur.koreanName ?? cur.nameKo ?? cur.nm ?? cur.hname ?? cur.companyName ?? cur.korName ?? cur.stock_name ?? ''
    ).trim();
    const market = String(cur.marketType ?? cur.market ?? cur.exchange ?? cur.typeCode ?? cur.nationType ?? cur.marketName ?? cur.mksc_shrn_iscd ?? '').trim();
    if (/^\d{6}$/.test(code)) return { symbol: code, name: name || undefined, market: normalizeMarket(market) };

    for (const value of Object.values(cur)) {
      if (Array.isArray(value)) stack.push(value);
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: JSON_HEADERS, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // 일부 자동완성 API가 JSONP/스크립트 형태로 내려오는 경우를 대비합니다.
    const match = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
    if (match?.[1]) return JSON.parse(match[1]);
    throw new Error('JSON 응답이 아닙니다.');
  }
}

async function resolveSymbol(query: string) {
  const q = cleanQuery(query);
  if (/^\d{6}$/.test(q)) return { symbol: q, name: q };

  const common = findCommonStock(q);
  if (common) return common;

  const encoded = encodeURIComponent(q);
  const urls = [
    `https://m.stock.naver.com/api/search/all?keyword=${encoded}`,
    `https://m.stock.naver.com/api/search/stock?keyword=${encoded}`,
    `https://m.stock.naver.com/front-api/search/autoComplete?keyword=${encoded}`,
    `https://ac.finance.naver.com/ac?q=${encoded}&q_enc=UTF-8&st=111&r_format=json&r_enc=UTF-8`,
    `https://ac.finance.naver.com/ac?q=${encoded}&q_enc=UTF-8&st=111&r_format=json`,
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
