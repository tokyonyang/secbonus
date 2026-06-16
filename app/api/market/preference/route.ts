import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { verifySalaryToken } from '../../_lib/salary-auth';

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const payload = verifySalaryToken(request.headers.get('authorization'));
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('salary_users')
      .select('preferred_stock_symbol,preferred_stock_name,preferred_stock_market,preferred_stock_updated_at')
      .eq('id', payload.userId)
      .single();
    if (error) throw error;
    return NextResponse.json({
      preference: data?.preferred_stock_symbol ? {
        symbol: data.preferred_stock_symbol,
        name: data.preferred_stock_name || data.preferred_stock_symbol,
        market: data.preferred_stock_market || null,
        updatedAt: data.preferred_stock_updated_at || null,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '선호 종목 조회 실패' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = verifySalaryToken(request.headers.get('authorization'));
    const body = await request.json();
    const symbol = clean(body.symbol, 20).replace(/\.KS$|\.KQ$/i, '');
    const name = clean(body.name || symbol, 60);
    const market = clean(body.market, 30);
    if (!/^\d{6}$/.test(symbol)) {
      return NextResponse.json({ error: '국내 주식 6자리 종목코드만 저장할 수 있습니다.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('salary_users')
      .update({
        preferred_stock_symbol: symbol,
        preferred_stock_name: name,
        preferred_stock_market: market || null,
        preferred_stock_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true, preference: { symbol, name, market: market || null } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '선호 종목 저장 실패' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = verifySalaryToken(request.headers.get('authorization'));
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('salary_users')
      .update({
        preferred_stock_symbol: null,
        preferred_stock_name: null,
        preferred_stock_market: null,
        preferred_stock_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '선호 종목 초기화 실패' }, { status: 500 });
  }
}
