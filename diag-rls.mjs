// TEMPORARY Phase 4 diagnostic — RLS ownership + real INSERT with the ACTUAL
// existing public.projects columns. Creates 2 users + 1 project, then cleans up.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_PUBLISHABLE_KEY');
const mk = () => createClient(url, key);

const mkUser = async (tag) => {
  const c = mk();
  const email = `bs-p4rls-${tag}-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({
    email,
    password: 'P4Pass123!',
    options: { data: { full_name: `RLS ${tag}`, role: 'CUSTOMER', phone: null } },
  });
  if (error || !data.session) { console.error(`signUp ${tag}:`, error?.message ?? 'no session'); process.exit(1); }
  return { c, uid: data.user.id, email };
};

// 1) Probe: does the live app expose a schema list? (OpenAPI was blocked)
// 2) Actual INSERT using ONLY columns known to exist on the live table.
const { c: A, uid: uidA } = await mk2();
const { c: B, uid: uidB } = await mk2b();

async function mk2() {
  const c = mk();
  const email = `bs-owner-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({
    email, password: 'P4Pass123!',
    options: { data: { full_name: 'RLS Owner', role: 'CUSTOMER', phone: null } },
  });
  if (error || !data.session) { console.error('owner signUp failed:', error?.message ?? 'no session'); process.exit(1); }
  return { c, uid: data.user.id, email };
}
async function mk2b() {
  const c = mk();
  const email = `bs-intruder-${Date.now()}@example.com`;
  const { data, error } = await c.auth.signUp({
    email, password: 'P4Pass123!',
    options: { data: { full_name: 'RLS Intruder', role: 'CUSTOMER', phone: null } },
  });
  if (error || !data.session) { console.error('intruder signUp failed:', error?.message ?? 'no session'); process.exit(1); }
  return { c, uid: data.user.id, email };
}

console.log('owner uid:', uidA);
console.log('intruder uid:', uidB);

const payload = {
  customer_id: uidA,
  name: 'My Dream Home (RLS probe)',
  building_type: 'Villa',
  description: 'Phase 4 RLS probe description',
  city: 'Bhimavaram',
  state: 'Andhra Pradesh',
  built_up_area: 1600,
  floors: 2,
  bedrooms: 3,
  bathrooms: 3,
  budget: 2500000,
  soil_type: null,
  status: 'DRAFT',
  priority: 'Cost Efficiency',
  design_style: 'Modern',
};
const ins = await A.from('projects').insert(payload).select('id,name,customer_id,created_at').single();
console.log('\nINSERT (owner):');
if (ins.error) {
  console.log('  FAILED', ins.error.code, ins.error.message, ins.error.details ?? '', ins.error.hint ?? '');
  process.exit(1);
}
const pid = ins.data.id;
console.log('  OK id=', pid, 'customer_id=', ins.data.customer_id, 'created_at=', ins.data.created_at);

const own = await A.from('projects').select('id,name,built_up_area,bedrooms,budget').eq('id', pid).maybeSingle();
console.log('SELECT (owner):', own.error ? `ERR ${own.error.code}` : own.data ? `OK ${JSON.stringify(own.data)}` : 'NO ROW');

const intrSelect = await B.from('projects').select('id,name').eq('id', pid).maybeSingle();
console.log('SELECT (intruder):', intrSelect.error ? `ERR ${intruder.error.code} ${intruder.error.message}` : intrSelect.data ? 'UNEXPECTEDLY VISIBLE' : 'OK BLOCKED (0 rows — RLS works)');

const intrUpdate = await B.from('projects').update({ name: 'HACKED' }).eq('id', pid).select('id').maybeSingle();
console.log('UPDATE (intruder):', intrUpdate.error ? `ERR ${intrUpdate.error.code} ${intrUpdate.error.message}` : intrUpdate.data ? `UNEXPECTEDLY UPDATED ${intrUpdate.data.id}` : 'OK BLOCKED (0 rows)');

const intrDelete = await B.from('projects').delete().eq('id', pid).select('id').maybeSingle();
console.log('DELETE (intruder):', intrDelete.error ? `ERR ${intrDelete.error.code} ${intrDelete.error.message}` : intrDelete.data ? 'UNEXPECTEDLY DELETED' : 'OK BLOCKED (0 rows)');

await A.from('projects').update({ name: 'My Dream Home (RLS probe, edited)' }).eq('id', pid).select('id').maybeSingle();
const afterUpdate = await A.from('projects').select('id,name').eq('id', pid).maybeSingle();
console.log('UPDATE (owner):', afterUpdate.error ? `ERR ${afterUpdate.error.code} ${afterUpdate.error.message}` : afterUpdate.data ? `OK name="${afterUpdate.data.name}"` : 'NO ROW');

const del = await A.from('projects').delete().eq('id', pid).select('id').maybeSingle();
console.log('DELETE (owner) cleanup:', del.error ? `ERR ${del.error.code} ${del.error.message}` : del.data ? 'OK removed' : 'already gone');

// Confirm the exact live columns one more time in a compact list
const existing = [
  'id', 'customer_id', 'name', 'building_type', 'description', 'city', 'state',
  'built_up_area', 'floors', 'bedrooms', 'bathrooms', 'budget', 'soil_type',
  'status', 'priority', 'design_style', 'created_at', 'updated_at',
];
const missingCheck = [];
for (const col of ['project_type', 'plot_size', 'budget_min', 'budget_max', 'construction_stage', 'requirements', 'contractor_id']) {
  const r = await A.from('projects').select(col).limit(0);
  if (r.error) missingCheck.push(col);
}
console.log('\nPhase-4 cols NOT on live DB:', missingCheck.join(', ') || '(none — all present)');
console.log('done');