import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../_lib/supabase';
import { verifySalaryToken } from '../_lib/salary-auth';

function cleanText(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function getBearer(request: NextRequest) {
  return request.headers.get('authorization');
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('inquiries')
      .select('id,user_id,nick,title,text,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '문의 목록 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = verifySalaryToken(getBearer(request));
    const body = await request.json();
    const title = cleanText(body.title, 80);
    const text = cleanText(body.text, 1000);
    const contact = cleanText(body.contact, 120);

    if (!title) return NextResponse.json({ error: '문의 제목을 입력해주세요.' }, { status: 400 });
    if (text.length < 5) return NextResponse.json({ error: '문의 내용을 5자 이상 입력해주세요.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: user, error: userError } = await supabase
      .from('salary_users')
      .select('id,login_id,display_name')
      .eq('id', auth.userId)
      .single();
    if (userError || !user) return NextResponse.json({ error: '로그인 정보를 다시 확인해주세요.' }, { status: 401 });

    const nick = cleanText(user.display_name || user.login_id, 30);
    const { data, error } = await supabase
      .from('inquiries')
      .insert({ user_id: user.id, nick, title, text, contact, status: '대기' })
      .select('id,user_id,nick,title,text,status,created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (error: any) {
    const message = error.message || '문의 등록 실패';
    const status = message.includes('로그인') || message.includes('인증') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
