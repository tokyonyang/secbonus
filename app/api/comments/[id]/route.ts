import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수가 필요합니다.');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!process.env.ADMIN_DELETE_KEY || body.adminKey !== process.env.ADMIN_DELETE_KEY) {
      return NextResponse.json({ error: '관리자 삭제키가 올바르지 않습니다.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('inquiries').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '삭제 실패' }, { status: 500 });
  }
}
