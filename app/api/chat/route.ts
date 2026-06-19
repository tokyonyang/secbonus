import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../_lib/supabase';
import { verifySalaryToken } from '../_lib/salary-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const after = url.searchParams.get('after');
    let query = supabase
      .from('chat_messages')
      .select('id,user_id,nick,message,created_at')
      .order('created_at', { ascending: true })
      .limit(120);

    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ messages: data ?? [], serverTime: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '채팅 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = verifySalaryToken(request.headers.get('authorization'));
    const body = await request.json();
    const message = cleanText(body.message, 500);
    if (message.length < 1) return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from('salary_users')
      .select('id,login_id,display_name')
      .eq('id', payload.userId)
      .single();
    if (userError || !user) return NextResponse.json({ error: '로그인 정보를 다시 확인해주세요.' }, { status: 401 });

    const nick = cleanText(user.display_name || user.login_id, 30);
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, nick, message })
      .select('id,user_id,nick,message,created_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ message: data });
  } catch (error: any) {
    const message = error.message || '채팅 등록 실패';
    const status = message.includes('로그인') || message.includes('인증') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
