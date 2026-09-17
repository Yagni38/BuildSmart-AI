import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

const { data: contractors, error: conErr } = await supabase.from('contractors').select('*');
console.log('contractors table rows:', contractors?.length, conErr);
if (contractors && contractors.length > 0) {
  console.log('Sample contractor:', contractors[0]);
}
