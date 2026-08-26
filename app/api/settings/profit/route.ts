import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { verifySalaryToken } from '../../_lib/salary-auth';

// 로그인 여부와 무관하게 동작해야 하므로, 토큰이 없거나 유효하지 않으면
// 에러를 던지지 않고 null을 반환하는 버전을 이 파일 안에서만 사용합니다.
function tryGetUserId(request: Request): string | null {
  try {
    const payload = verifySalaryToken(request.headers.get('authorization'));
    return payload.userId;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = tryGetUserId(request);

    // 로그인 사용자는 본인이 저장한 값이 있으면 그 값을 우선 반환합니다.
    if (userId) {
      const { data, error } = await supabase
        .from('salary_users')
        .select('preferred_profit,preferred_profit_updated_at')
        .eq('id', userId)
        .single();
      if (!error && data?.preferred_profit !== null && data?.preferred_profit !== undefined) {
        return NextResponse.json({
          value: Number(data.preferred_profit),
          source: 'user',
          updatedAt: data.preferred_profit_updated_at || null,
        });
      }
    }

    // 비로그인이거나 개인 저장값이 없으면, 누군가 가장 최근에 입력한 전역 공유값을 반환합니다.
    const { data: sharedData, error: sharedError } = await supabase
      .from('app_shared_settings')
      .select('value_num,updated_at')
      .eq('key', 'profit')
      .maybeSingle();
    if (sharedError) throw sharedError;

    return NextResponse.json({
      value: sharedData?.value_num !== null && sharedData?.value_num !== undefined ? Number(sharedData.value_num) : null,
      source: 'global',
      updatedAt: sharedData?.updated_at || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '영업이익 설정 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const value = Number(body.value);
    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: '유효한 숫자를 입력해주세요.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // 로그인 여부와 무관하게, 누군가 입력하면 전역 공유값이 항상 갱신됩니다.
    // 비로그인 사용자가 다음에 접속했을 때 이 값을 기본값으로 보게 됩니다.
    const { error: sharedError } = await supabase
      .from('app_shared_settings')
      .upsert({ key: 'profit', value_num: value, updated_at: now }, { onConflict: 'key' });
    if (sharedError) throw sharedError;

    // 로그인한 사용자는 본인 계정에도 별도로 저장해, 다음 접속 때 본인이 마지막으로
    // 설정한 값을 (전역 공유값과 무관하게) 우선 반영받습니다.
    const userId = tryGetUserId(request);
    if (userId) {
      const { error: userError } = await supabase
        .from('salary_users')
        .update({ preferred_profit: value, preferred_profit_updated_at: now, updated_at: now })
        .eq('id', userId);
      if (userError) throw userError;
    }

    return NextResponse.json({ ok: true, source: userId ? 'user' : 'global' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '영업이익 설정 저장 실패' }, { status: 500 });
  }
}
