import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../_lib/supabase';
import { hashPassword, signSalaryToken, verifyPassword } from '../../_lib/salary-auth';

function clean(value: unknown, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

function isValidLoginId(loginId: string) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(loginId);
}

function isValidPassword(password: string) {
  return password.length >= 6;
}

function isValidRecoveryCode(code: string) {
  return code.length >= 4;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = clean(body.mode, 30);
    const loginId = clean(body.loginId, 40).toLowerCase();
    const password = String(body.password ?? '');
    const newPassword = String(body.newPassword ?? '');
    const displayName = clean(body.displayName || loginId, 40);
    const recoveryCode = String(body.recoveryCode ?? '').trim();

    const supabase = getSupabaseAdmin();

    if (mode === 'find_id') {
      if (!displayName || !isValidRecoveryCode(recoveryCode)) {
        return NextResponse.json({ error: '표시 이름과 복구코드를 입력해주세요.' }, { status: 400 });
      }

      const { data: users, error } = await supabase
        .from('salary_users')
        .select('login_id,display_name,recovery_salt,recovery_hash')
        .eq('display_name', displayName)
        .limit(20);
      if (error) throw error;

      const matched = (users || [])
        .filter((user: any) => user.recovery_salt && user.recovery_hash && verifyPassword(recoveryCode, user.recovery_salt, user.recovery_hash))
        .map((user: any) => user.login_id);

      if (matched.length === 0) {
        return NextResponse.json({ error: '일치하는 아이디가 없습니다.' }, { status: 404 });
      }
      return NextResponse.json({ loginIds: matched });
    }

    if (mode === 'reset_password') {
      if (!isValidLoginId(loginId)) {
        return NextResponse.json({ error: '아이디는 영문/숫자/._- 조합 3~40자로 입력해주세요.' }, { status: 400 });
      }
      if (!displayName || !isValidRecoveryCode(recoveryCode)) {
        return NextResponse.json({ error: '표시 이름과 복구코드를 입력해주세요.' }, { status: 400 });
      }
      if (!isValidPassword(newPassword)) {
        return NextResponse.json({ error: '새 비밀번호는 6자 이상 입력해주세요.' }, { status: 400 });
      }

      const { data: user, error } = await supabase
        .from('salary_users')
        .select('id,login_id,display_name,recovery_salt,recovery_hash')
        .eq('login_id', loginId)
        .single();
      if (error || !user) return NextResponse.json({ error: '일치하는 사용자 정보가 없습니다.' }, { status: 404 });
      if (user.display_name !== displayName || !user.recovery_salt || !user.recovery_hash || !verifyPassword(recoveryCode, user.recovery_salt, user.recovery_hash)) {
        return NextResponse.json({ error: '일치하는 사용자 정보가 없습니다.' }, { status: 404 });
      }

      const { salt, hash } = hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from('salary_users')
        .update({ password_salt: salt, password_hash: hash, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true, message: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.' });
    }

    if (!isValidLoginId(loginId)) {
      return NextResponse.json({ error: '아이디는 영문/숫자/._- 조합 3~40자로 입력해주세요.' }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return NextResponse.json({ error: '비밀번호는 6자 이상 입력해주세요.' }, { status: 400 });
    }

    if (mode === 'register') {
      if (!isValidRecoveryCode(recoveryCode)) {
        return NextResponse.json({ error: '아이디/비밀번호 찾기에 사용할 복구코드를 4자 이상 입력해주세요.' }, { status: 400 });
      }
      const { salt, hash } = hashPassword(password);
      const { salt: recoverySalt, hash: recoveryHash } = hashPassword(recoveryCode);
      const { data, error } = await supabase
        .from('salary_users')
        .insert({
          login_id: loginId,
          display_name: displayName,
          password_salt: salt,
          password_hash: hash,
          recovery_salt: recoverySalt,
          recovery_hash: recoveryHash,
        })
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
