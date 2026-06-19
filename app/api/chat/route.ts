import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../_lib/supabase';
import { verifySalaryToken } from '../_lib/salary-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function cleanText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function tryVerifySalaryToken(header: string | null) {
  try {
    if (!header) return null;
    return verifySalaryToken(header);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = tryVerifySalaryToken(request.headers.get('authorization'));
    if (!payload?.userId) {
      return NextResponse.json({ messages: [], historyLocked: true, serverTime: new Date().toISOString() });
    }

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
    return NextResponse.json({ messages: data ?? [], historyLocked: false, serverTime: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '채팅 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = tryVerifySalaryToken(request.headers.get('authorization'));
    const body = await request.json();
    const message = cleanText(body.message, 500);
    if (message.length < 1) return NextResponse.json({ error: '메시지를 입력해주세요.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let userId: string | null = null;
    let nick = cleanText(body.nick, 30) || '방문자';

    if (payload?.userId) {
      const { data: user, error: userError } = await supabase
        .from('salary_users')
        .select('id,login_id,display_name')
        .eq('id', payload.userId)
        .single();
      if (!userError && user) {
        userId = user.id;
        nick = cleanText(user.display_name || user.login_id, 30) || nick;
      }
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, nick, message })
      .select('id,user_id,nick,message,created_at')
      .single();
    if (error) throw error;
    return NextResponse.json({ message: data, historyLocked: !userId });
  } catch (error: any) {
    const message = error.message || '채팅 등록 실패';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
