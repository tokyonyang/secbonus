import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { hashPassword, signSalaryToken, verifyPassword } from '../../_lib/salary-auth';

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

function isValidLoginId(loginId: string) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(loginId);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = clean(body.mode, 20);
    const loginId = clean(body.loginId, 40).toLowerCase();
    const password = String(body.password ?? '');
    const displayName = clean(body.displayName || loginId, 40);

    if (!isValidLoginId(loginId)) {
      return NextResponse.json({ error: '아이디는 영문/숫자/._- 조합 3~40자로 입력해주세요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상 입력해주세요.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (mode === 'register') {
      const { salt, hash } = hashPassword(password);
      const { data, error } = await supabase
        .from('salary_users')
        .insert({ login_id: loginId, display_name: displayName, password_salt: salt, password_hash: hash })
        .select('id,login_id,display_name')
        .single();
      if (error) {
        if (String(error.message || '').includes('duplicate')) {
          return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
        }
        throw error;
      }
      return NextResponse.json({ token: signSalaryToken({ userId: data.id, loginId: data.login_id }), user: data });
    }

    const { data: user, error } = await supabase
      .from('salary_users')
      .select('id,login_id,display_name,password_salt,password_hash')
      .eq('login_id', loginId)
      .single();
    if (error || !user) return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    if (!verifyPassword(password, user.password_salt, user.password_hash)) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    return NextResponse.json({
      token: signSalaryToken({ userId: user.id, loginId: user.login_id }),
      user: { id: user.id, login_id: user.login_id, display_name: user.display_name },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '연봉 로그인 처리 실패' }, { status: 500 });
  }
}
