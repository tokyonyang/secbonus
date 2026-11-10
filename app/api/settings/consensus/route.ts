import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';

// ─────────────────────────────────────────────────────────────
// 증권사 컨센서스(영업이익 전망) 설정 — DB 기반 프리셋
// - 클라이언트(calculator.html)는 첫 로드 시 GET으로 이 설정을 읽어
//   프리셋을 적용한다. DB에 값이 없거나 API가 실패하면 클라이언트는
//   코드에 내장된 DEFAULT_CONSENSUS와 동일한 기본값을 그대로 쓴다.
//   (계산기는 이 엔드포인트가 없어도 절대 깨지지 않는다.)
// - 숫자 변경은 POST(관리자 키 필요)로만 하며, 자동 수집·자동 반영은
//   하지 않는다. 새 컨센서스는 사람이 확인한 뒤에 반영하는 것이 원칙이다.
// ─────────────────────────────────────────────────────────────

type Scenario = {
  id: string;
  label: string;
  dsProfitJo: number;
  totalProfitJo: number;
  source: string;
  asOf: string;
};

type ConsensusConfig = {
  scenarios: Record<string, Scenario>;
  defaultScenarioId: string;
  dispersionNote: string;
};

export const DEFAULT_CONSENSUS: ConsensusConfig = {
  scenarios: {
    conservative: {
      id: 'conservative',
      label: '보수적 · 기존 기본값',
      dsProfitJo: 50,
      totalProfitJo: 65,
      source: '기존 사이트 기본값, 2025년 DS 실적 43.6조 기준',
      asOf: '2026-11-10 확인',
    },
    consensus: {
      id: 'consensus',
      label: '기본 · 컨센서스',
      dsProfitJo: 370,
      totalProfitJo: 372,
      source: 'FnGuide 컨센서스 전사 371.7조(2026-10-26) + DS 약 370조 추산',
      asOf: '2026-10-26',
    },
    optimistic: {
      id: 'optimistic',
      label: '낙관',
      dsProfitJo: 390,
      totalProfitJo: 400,
      source: '키움증권 DS 2026E 약 390조 표기',
      asOf: '2026-10-30 보고서 기준',
    },
  },
  defaultScenarioId: 'consensus',
  dispersionNote: '증권사별 편차 큼: KB DS 208조 ~ 키움 DS 390조',
};

function isValidConsensus(value: unknown): value is ConsensusConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const scenarios = v.scenarios;
  if (!scenarios || typeof scenarios !== 'object') return false;
  const map = scenarios as Record<string, unknown>;
  // 기본(컨센서스) 시나리오는 반드시 있어야 한다.
  if (!map.consensus || typeof map.consensus !== 'object') return false;
  for (const key of Object.keys(map)) {
    const sc = map[key];
    if (!sc || typeof sc !== 'object') return false;
    const s = sc as Record<string, unknown>;
    if (!Number.isFinite(Number(s.dsProfitJo)) || !Number.isFinite(Number(s.totalProfitJo))) return false;
    if (typeof s.source !== 'string' || typeof s.asOf !== 'string') return false;
  }
  if (typeof v.defaultScenarioId !== 'string' || !(v.defaultScenarioId in map)) return false;
  if (v.dispersionNote !== undefined && typeof v.dispersionNote !== 'string') return false;
  return true;
}

function getAdminKey(request: Request) {
  return request.headers.get('x-admin-key') || '';
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('app_shared_settings')
      .select('value_json,updated_at')
      .eq('key', 'consensus')
      .maybeSingle();
    if (error) throw error;

    // 저장된 행이 있고 형식이 유효하면 DB 값을 그대로 반환한다.
    if (data?.value_json) {
      if (isValidConsensus(data.value_json)) {
        const stored = data.value_json;
        return NextResponse.json({
          source: 'db',
          updatedAt: data.updated_at || null,
          scenarios: stored.scenarios,
          defaultScenarioId: stored.defaultScenarioId,
          dispersionNote: stored.dispersionNote || DEFAULT_CONSENSUS.dispersionNote,
        });
      }
      // 형식이 깨진 저장값은 무시하고 내장 기본값을 반환한다 (덮어쓰지 않음).
      return NextResponse.json({ source: 'builtin', ...DEFAULT_CONSENSUS });
    }

    // 행이 없으면 내장 기본값을 한 번 심어두고 'seeded'로 반환한다.
    // (value_json 컬럼이 아직 없으면 이 upsert가 실패하고 builtin으로 떨어진다.)
    try {
      const now = new Date().toISOString();
      const { error: seedError } = await supabase
        .from('app_shared_settings')
        .upsert({ key: 'consensus', value_json: DEFAULT_CONSENSUS, updated_at: now }, { onConflict: 'key' });
      if (seedError) throw seedError;
      return NextResponse.json({ source: 'seeded', updatedAt: now, ...DEFAULT_CONSENSUS });
    } catch {
      return NextResponse.json({ source: 'builtin', ...DEFAULT_CONSENSUS });
    }
  } catch {
    // Supabase 환경변수·컬럼 미비 등 어떤 오류에서도 계산기가 깨지지 않게
    // 내장 기본값을 HTTP 200으로 반환한다.
    return NextResponse.json({ source: 'builtin', ...DEFAULT_CONSENSUS });
  }
}

export async function POST(request: Request) {
  const adminKey = process.env.ADMIN_DELETE_KEY || '';
  if (!adminKey) {
    return NextResponse.json({ error: '서버에 관리자 키가 설정되지 않았습니다.' }, { status: 503 });
  }
  if (getAdminKey(request) !== adminKey) {
    return NextResponse.json({ error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!isValidConsensus(body)) {
    return NextResponse.json(
      { error: '컨센서스 설정 형식이 올바르지 않습니다. consensus 시나리오와 숫자(DS/전사 영업이익)가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const config: ConsensusConfig = {
      scenarios: body.scenarios,
      defaultScenarioId: body.defaultScenarioId,
      dispersionNote: body.dispersionNote || DEFAULT_CONSENSUS.dispersionNote,
    };
    const { error } = await supabase
      .from('app_shared_settings')
      .upsert({ key: 'consensus', value_json: config, updated_at: now }, { onConflict: 'key' });
    if (error) throw error;

    // 하위 호환: 기존 전역 공유 영업이익 행(key='profit')도 컨센서스
    // 시나리오의 DS 영업이익으로 함께 맞춘다.
    const dsProfitJo = Number(body.scenarios.consensus.dsProfitJo);
    const { error: profitError } = await supabase
      .from('app_shared_settings')
      .upsert({ key: 'profit', value_num: dsProfitJo, updated_at: now }, { onConflict: 'key' });
    if (profitError) throw profitError;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '컨센서스 설정 저장 실패' }, { status: 500 });
  }
}
