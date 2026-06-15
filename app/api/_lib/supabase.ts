import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase 환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
