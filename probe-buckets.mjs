// READ-ONLY storage bucket probe + site_logs visibility probe.
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

const buckets = ['site-photos', 'construction-updates', 'contractor-resumes', 'ai-designs', 'contractor-documents', 'resumes'];
console.log('=== BUCKET PROBE (anon) ===');
for (const b of buckets) {
  const { data, error } = await supabase.storage.from(b).list('', { limit: 1 });
  if (error) console.log(`  ${b}: ERROR -> ${error.message}`);
  else console.log(`  ${b}: EXISTS (list ok, ${data?.length ?? 0} entries at root)`);
}

console.log('\n=== site_logs anon visibility ===');
const { data: sl, error: slErr } = await supabase.from('site_logs').select('id,project_id,contractor_id,description,image_url,created_at').limit(5);
console.log('rows:', sl?.length ?? 0, 'error:', slErr?.message ?? 'none');
if (sl?.length) console.log(JSON.stringify(sl, null, 2));

console.log('\n=== projects anon visibility ===');
const { data: pr, error: prErr } = await supabase.from('projects').select('id,name,status,progress,budget,contractor_id,customer_id,created_at').limit(5);
console.log('rows:', pr?.length ?? 0, 'error:', prErr?.message ?? 'none');
if (pr?.length) console.log(JSON.stringify(pr, null, 2));

console.log('\n=== notifications anon visibility ===');
const { data: nt, error: ntErr } = await supabase.from('notifications').select('*').limit(5);
console.log('rows:', nt?.length ?? 0, 'error:', ntErr?.message ?? 'none');
if (nt?.length) console.log(JSON.stringify(nt, null, 2));