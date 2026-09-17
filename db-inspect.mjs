// READ-ONLY live schema/data inspector (anon key only; no writes performed).
// Reports row counts + actual returned column keys for the app's live tables.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  'profiles',
  'contractor_profiles',
  'projects',
  'project_milestones',
  'site_logs',
  'construction_photos',
  'contractor_documents',
  'contractor_matches',
  'quotes',
  'budget_items',
  'construction_materials',
  'messages',
];

console.log('=== LIVE TABLE PROBE (anon / RLS-filtered, READ ONLY) ===\n');

for (const t of TABLES) {
  const { data, error } = await supabase.from(t).select('*').limit(50);
  if (error) {
    console.log(`${t.padEnd(24)} ERROR  code=${error.code}  ${error.message}`);
  } else {
    const keys = data && data.length ? Object.keys(data[0]).sort().join(', ') : '(no rows visible)';
    console.log(`${t.padEnd(24)} rows=${String(data?.length ?? 0).padEnd(4)} cols: ${keys}`);
  }
}

console.log('\n=== STORAGE BUCKETS (anon view) ===');
const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
if (bErr) console.log('listBuckets error:', bErr.message);
else console.log((buckets ?? []).map((b) => `${b.id} (public=${b.public})`).join('\n') || '(none visible)');
