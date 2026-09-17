// One-shot: sign in the Phase 1 test customer and print URL-hash params for
// headless rendering verification (anon key only).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') || get('VITE_SUPABASE_PUBLISHABLE_KEY');

const sb = createClient(url, key);
const { data, error } = await sb.auth.signInWithPassword({
  email: process.argv[2],
  password: process.argv[3],
});
if (error) {
  console.error('SIGNIN_FAILED:', error.message);
  process.exit(1);
}
const s = data.session;
console.log(`access_token=${s.access_token}`);
console.log(`refresh_token=${s.refresh_token}`);
console.log(`uid=${s.user.id}`);
process.exit(0);
