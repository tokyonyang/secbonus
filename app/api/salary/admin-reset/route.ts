import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';

function getAdminKey(request: Request) {
  return request.headers.get('x-admin-key') || '';
}

export async function POST(request: Request) {
  try {
    const adminKey = process.env.ADMIN_DELETE_KEY || '';
    if (!adminKey || getAdminKey(request) !== adminKey) {
      return NextResponse.json({ error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'RESET_SALARY_USERS') {
      return NextResponse.json({ error: '초기화 확인 문구가 필요합니다.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('salary_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;

    return NextResponse.json({ ok: true, message: '사용자 등록리스트와 연봉 누적자료가 초기화되었습니다.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '사용자 등록리스트 초기화 실패' }, { status: 500 });
  }
}
