// TEMPORARY Phase 4 diagnostic — discover allowed status values and column types
// of the live public.projects table by behavioral probes.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const c = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_PUBLISHABLE_KEY'));
const email = `bs-enum-${Date.now()}@example.com`;
const { data, error } = await c.auth.signUp({
  email, password: 'P4Pass123!',
  options: { data: { full_name: 'Enum Probe', role: 'CUSTOMER', phone: null } },
});
if (error || !data.session) { console.error('signUp:', error?.message ?? 'no session'); process.exit(1); }
const uid = data.user.id;

const candidates = ['DRAFT', 'PLANNING', 'SUBMITTED', 'IN_PROGRESS', 'ACTIVE_BUILD', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ACTIVE'];
console.log('=== status CHECK constraint candidates ===');
for (const status of candidates) {
  const r = await c.from('projects')
    .insert({ customer_id: uid, name: `Enum probe ${status}`, status })
    .select('id,status')
    .maybeSingle();
  if (r.error) {
    if (String(r.error.code) === '23514') console.log(`  ${status.padEnd(14)} -> REJECTED (23514 check)`);
    else console.log(`  ${status.padEnd(14)} -> ERR ${r.error.code} ${r.error.message}`);
  } else {
    console.log(`  ${status.padEnd(14)} -> ALLOWED (id=${r.data.id})`);
    await c.from('projects').delete().eq('id', r.data.id);
  }
}

// Same but when status is omitted entirely (uses column DEFAULT if one exists).
const nod = await c.from('projects').insert({ customer_id: uid, name: 'No status probe' }).select('id,status').maybeSingle();
console.log('omitted status ->', nod.error ? `ERR ${nod.error.code}: ${nod.error.message}` : `DEFAULT="status" id=${nod.data.id}`);
if (nod.data) { await c.from('projects').delete().eq('id', nod.data.id); }

// Type probes: numbers into numeric-ish columns, string into numeric.
for (const [label, payload] of [
  ['floors numeric (2.5)', { floors: 2.5 }],
  ['bedrooms numeric (3.5)', { bedrooms: 3.5 }],
  ['budget numeric', { budget: 2600000 }],
  ['built_up_area text "1600"', { built_up_area: '1600' }],
]) {
  const r = await c.from('projects').select('*').eq('id', 'aaaaaaaa-0000-0000-0000-000000000000');
  // ignore, just placeholder — real type probe below
}
console.log('type probe result:', 'probes below');

for (const [label, row] of [
  ['floors=2.5', { floors: 2.5 }],
  ['budget="abc"', { budget: 'abc' }],
  ['bedrooms=4', { bedrooms: 4 }],
]) {
  const ins = await c.from('projects').insert({ customer_id: uid, name: `Type probe ${label}`, ...row }).select('id').maybeSingle();
  console.log(`  insert ${label}:`, ins.error ? `ERR ${ins.error.code} ${ins.error.message}` : `OK id=${ins.data.id}`);
  if (ins.data) { await c.from('projects').delete().eq('id', ins.data.id); }
}
console.log('uid:', uid);