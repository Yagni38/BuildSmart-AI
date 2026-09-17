// READ-ONLY probe: do Phase-11 estimate tables exist on the live DB?
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => (env.match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1];
const supabase = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'));

for (const t of ['budget_items', 'construction_materials']) {
  const { error } = await supabase.from(t).select('*').limit(0);
  console.log(t, error ? `MISSING [${error.code}] ${error.message}` : 'EXISTS');
}
