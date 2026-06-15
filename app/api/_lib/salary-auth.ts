import crypto from 'crypto';

const ITERATIONS = 120000;
const KEYLEN = 64;
const DIGEST = 'sha512';

function getSecret() {
  return process.env.SALARY_JWT_SECRET || process.env.ADMIN_DELETE_KEY || 'change-this-salary-secret';
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function signSalaryToken(payload: { userId: string; loginId: string }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

export function verifySalaryToken(authHeader: string | null) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  const [header, body, sig] = token.split('.');
  if (!header || !body || !sig) throw new Error('로그인이 필요합니다.');
  const unsigned = `${header}.${body}`;
  const expected = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('인증 토큰이 올바르지 않습니다.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('로그인이 만료되었습니다.');
  return payload as { userId: string; loginId: string; exp: number };
}
