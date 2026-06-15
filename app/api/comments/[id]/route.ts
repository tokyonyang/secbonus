import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { verifySalaryToken } from '../../_lib/salary-auth';

type DeleteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: DeleteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const adminKey = String(body.adminKey || '').trim();
    if (process.env.ADMIN_DELETE_KEY && adminKey && adminKey === process.env.ADMIN_DELETE_KEY) {
      const { error } = await supabase.from('inquiries').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const auth = verifySalaryToken(request.headers.get('authorization'));
    const { data, error } = await supabase
      .from('inquiries')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '본인이 작성한 게시글만 삭제할 수 있습니다.' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '삭제 실패';
    const status = message.includes('로그인') || message.includes('인증') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
