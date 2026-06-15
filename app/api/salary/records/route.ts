import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { verifySalaryToken } from '../../_lib/salary-auth';

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}
function num(value: unknown, min = 0, max = 999999) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export async function GET(request: Request) {
  try {
    const auth = verifySalaryToken(request.headers.get('authorization'));
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('salary_records')
      .select('id,year,cl,division,contract_salary_man,base_up_raise_rate,performance_raise_rate,raise_rate,business_performance_bonus_man,withholding_income_man,memo,created_at,updated_at')
      .eq('user_id', auth.userId)
      .order('year', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '연봉정보 조회 실패' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = verifySalaryToken(request.headers.get('authorization'));
    const body = await request.json();
    const year = Math.round(num(body.year, 2011, 2100));
    const payload = {
      user_id: auth.userId,
      year,
      cl: clean(body.cl, 20) || 'CL23',
      division: clean(body.division, 30) || 'memory',
      contract_salary_man: Math.round(num(body.contractSalaryMan, 1, 200000)),
      base_up_raise_rate: num(body.baseUpRaiseRate, -100, 100),
      performance_raise_rate: num(body.performanceRaiseRate, -100, 100),
      raise_rate: num(body.raiseRate, -100, 100),
      business_performance_bonus_man: Math.round(num(body.businessPerformanceBonusMan, 0, 200000)),
      withholding_income_man: Math.round(num(body.withholdingIncomeMan, 0, 300000)),
      memo: clean(body.memo, 500),
      updated_at: new Date().toISOString(),
    };
    if (!payload.contract_salary_man) {
      return NextResponse.json({ error: '올해 체결연봉을 입력해주세요.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('salary_records')
      .upsert(payload, { onConflict: 'user_id,year' })
      .select('id,year,cl,division,contract_salary_man,base_up_raise_rate,performance_raise_rate,raise_rate,business_performance_bonus_man,withholding_income_man,memo,created_at,updated_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '연봉정보 저장 실패' }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  try {
    const auth = verifySalaryToken(request.headers.get('authorization'));
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const id = clean(url.searchParams.get('id') || body.id, 80);
    const year = Math.round(num(url.searchParams.get('year') || body.year, 0, 2100));

    if (!id && !year) {
      return NextResponse.json({ error: '삭제할 연봉정보 ID 또는 연도가 없습니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('salary_records')
      .delete({ count: 'exact' })
      .eq('user_id', auth.userId);

    if (id) query = query.eq('id', id);
    else query = query.eq('year', year);

    const { error, count } = await query;
    if (error) throw error;
    if (!count) {
      return NextResponse.json({ error: '삭제할 연봉정보를 찾지 못했습니다. 새로고침 후 다시 시도해주세요.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '연봉정보 삭제 실패' }, { status: 500 });
  }
}
