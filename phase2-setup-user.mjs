// One-shot: ensure a deterministic Phase 2 test customer exists (anon key).
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
const email = 'phase2-visual-test@example.com';
const password = 'phase2-test-1234';

// Try login first (re-run safe).
let { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error) {
  const up = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Phase2 Visual Test', role: 'CUSTOMER' } },
  });
  if (up.error) {
    console.error('SETUP_FAILED:', up.error.message);
    process.exit(1);
  }
  ({ data, error } = await sb.auth.signInWithPassword({ email, password }));
  if (error) {
    console.error('LOGIN_AFTER_SIGNUP_FAILED:', error.message);
    process.exit(1);
  }
}
const s = data.session;
console.log(`access_token=${s.access_token}`);
console.log(`refresh_token=${s.refresh_token}`);
process.exit(0);
