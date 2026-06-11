import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from './supabase';

function cleanText(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('inquiries')
      .select('id,nick,title,text,status,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '문의 목록 조회 실패' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nick = cleanText(body.nick, 30);
    const title = cleanText(body.title, 80);
    const text = cleanText(body.text, 1000);
    const contact = cleanText(body.contact, 120);

    if (!nick) return NextResponse.json({ error: '이름 또는 닉네임을 입력해주세요.' }, { status: 400 });
    if (!title) return NextResponse.json({ error: '문의 제목을 입력해주세요.' }, { status: 400 });
    if (text.length < 5) return NextResponse.json({ error: '문의 내용을 5자 이상 입력해주세요.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('inquiries')
      .insert({ nick, title, text, contact, status: '대기' })
      .select('id,nick,title,text,status,created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '문의 등록 실패' }, { status: 500 });
  }
}
