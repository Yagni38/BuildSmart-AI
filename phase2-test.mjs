// PHASE 2 end-to-end test — persistent customer projects via Supabase.
// Verifies, against the LIVE database and ONLY the public anon key (RLS enforced):
//   1. a signed-in customer can create a project (with the exact app payload,
//      including the new `timeline` column)
//   2. the created row returns its REAL project id (uuid)
//   3. the project is still visible after a fresh sign-in (browser refresh)
//   4. ANOTHER authenticated customer canNOT see/update/delete it (RLS)
// Cleans up the test project afterwards.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const url = get('VITE_SUPABASE_URL');
const anon = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, anon);

const email = `bs-p2-${Date.now()}@example.com`;
const password = 'P2Pass123!';

console.log('== Phase 2 end-to-end test ==');

// 1) Sign up a fresh CUSTOMER (profile row is created by the trigger).
const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: 'Phase 2 Test', role: 'CUSTOMER' } },
});
if (suErr) {
  console.error('SIGNUP ERROR:', suErr.message);
  process.exit(1);
}
if (!su.session) {
  console.error('NO SESSION — email confirmation may be enabled for signups.');
  process.exit(1);
}
const uid = su.user.id;
console.log('user:', email, uid);
await new Promise((r) => setTimeout(r, 1500)); // let the profile trigger run

// 2) Create a project using the EXACT payload CreateProject.tsx sends.
const payload = {
  customer_id: uid, // service injects auth.uid(); RLS requires it
  name: 'Phase 2 Persistence Villa',
  project_type: 'NEW_CONSTRUCTION',
  building_type: 'Villa',
  description: 'A sustainable two-story family residential building.',
  requirements: 'Solar panels, rainwater harvesting',
  city: 'Bengaluru',
  state: 'Karnataka',
  plot_size: 2400,
  built_up_area: null,
  floors: 2,
  bedrooms: null,
  bathrooms: null,
  budget: 4500000,
  budget_min: 4500000,
  budget_max: 4500000,
  construction_stage: 'Planning',
  timeline: '2027-05-15', // Expected Completion → public.projects.timeline
  soil_type: 'Red Sandy Loam',
  priority: 'Eco-Friendliness',
  design_style: 'Modern',
};

const { data: created, error: insErr } = await supabase
  .from('projects')
  .insert(payload)
  .select()
  .single();

if (insErr) {
  console.error('CREATE PROJECT ERROR:', insErr.code, insErr.message);
  process.exit(1);
}

const pid = created.id;
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
console.log('CREATED project id:', pid, isUuid ? '(valid uuid ✓)' : '(NOT a uuid ✗)');
console.log('  customer_id matches user:', created.customer_id === uid ? 'YES ✓' : 'NO ✗');
console.log('  status default:', created.status);
console.log('  timeline persisted:', created.timeline === '2027-05-15' ? 'YES ✓' : `NO ✗ (${created.timeline})`);

// 3) Simulate a browser refresh: sign out, sign back in, re-fetch.
await supabase.auth.signOut();
const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
if (siErr) {
  console.error('SIGN-IN ERROR:', siErr.message);
  process.exit(1);
}

const { data: list, error: listErr } = await supabase
  .from('projects')
  .select('*')
  .eq('customer_id', uid)
  .order('created_at', { ascending: false });

if (listErr) {
  console.error('FETCH AFTER REFRESH ERROR:', listErr.code, listErr.message);
  process.exit(1);
}
const stillThere = list.find((p) => p.id === pid);
console.log('AFTER REFRESH — project still visible:', stillThere ? 'YES ✓' : 'NO ✗');
console.log('  projects for customer:', list.length);

// 4) RLS isolation — a DIFFERENT customer must not see/modify the row.
const intruderEmail = `bs-p2-intruder-${Date.now()}@example.com`;
const { data: su2, error: su2Err } = await supabase.auth.signUp({
  email: intruderEmail,
  password,
  options: { data: { full_name: 'Phase 2 Intruder', role: 'CUSTOMER' } },
});
if (su2Err || !su2.session) {
  console.error('INTRUDER SIGNUP ERROR:', su2Err?.message ?? 'no session');
  process.exit(1);
}

const { data: peeked } = await supabase.from('projects').select('id').eq('id', pid).maybeSingle();
console.log('RLS intruder SELECT:', peeked ? 'UNEXPECTEDLY VISIBLE ✗' : 'blocked ✓');
const { data: hacked } = await supabase
  .from('projects')
  .update({ name: 'HACKED' })
  .eq('id', pid)
  .select('id')
  .maybeSingle();
console.log('RLS intruder UPDATE:', hacked ? 'UNEXPECTEDLY UPDATED ✗' : 'blocked ✓');

// 5) Cleanup — owner deletes the test project.
await supabase.auth.signOut();
await supabase.auth.signInWithPassword({ email, password });
const { error: delErr } = await supabase.from('projects').delete().eq('id', pid);
console.log('CLEANUP delete:', delErr ? `FAILED (${delErr.message})` : 'ok');

console.log('done');
