// READ-ONLY: print the RAW error for each suspect column + list storage buckets.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const checks = [
  ['contractor_profiles', 'profile_id'],
  ['contractor_profiles', 'user_id'],
  ['contractor_profiles', 'id'],
  ['site_logs', 'updated_at'],
  ['site_logs', 'log_date'],
  ['projects', 'estimated_cost'],
  ['project_milestones', 'completion_percent'],
];

for (const [t, c] of checks) {
  const { error, status } = await supabase.from(t).select(c).limit(0);
  console.log(`${t}.${c} -> status=${status} error=${error ? JSON.stringify(error) : 'NONE (column OK)'}`);
}

console.log('\n== STORAGE BUCKETS ==');
const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
console.log(bErr ? 'error: ' + JSON.stringify(bErr) : JSON.stringify(buckets, null, 2));
