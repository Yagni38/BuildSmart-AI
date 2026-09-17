// TEMPORARY Phase 4 diagnostic — live default status value + full cross-user RLS.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const mk = () => createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_PUBLISHABLE_KEY'));

async function me(tag) {
  const c = mk();
  const { data, error } = await c.auth.signUp({
    email: `bs-rls2-${tag}-${Date.now()}@example.com`,
    password: 'P4Pass123!',
    options: { data: { full_name: `RLS2 ${tag}`, role: 'CUSTOMER', phone: null } },
  });
  if (error || !data.session) { console.error(`signUp ${tag}:`, error?.message ?? 'no session'); process.exit(1); }
  return { c, uid: data.user.id };
}

const A = await me('owner');
const B = await me('intruder');

// Find the column DEFAULT for status: insert without status.
const def = await A.c.from('projects').insert({ customer_id: A.uid, name: 'Status default probe' }).select('id,status').maybeSingle();
console.log('default status ->', def.error ? `ERR ${def.error.code} ${def.error.message}` : JSON.stringify(def.data));
if (def.data?.id) { await A.c.from('projects').delete().eq('id', def.data.id); }

if (def.error) process.exit(1);

const payload = {
  customer_id: A.uid,
  name: 'My Dream Home (RLS finals)',
  building_type: 'Villa',
  description: 'Phase 4 final RLS check',
  city: 'Bhimavaram',
  state: 'Andhra Pradesh',
  built_up_area: 1600,
  floors: 2,
  bedrooms: 3,
  bathrooms: 3,
  budget: 2500000,
};
const ins = await A.c.from('projects').insert(payload).select('id,name,customer_id,status,budget,created_at').single();
console.log('\nINSERT(owner):', ins.error ? `FAILED ${ins.error.code} ${ins.error.message}` : `OK id=${ins.data.id}`);
const pid = ins.data?.id;
if (!pid) process.exit(1);

const own = await A.c.from('projects').select('*').eq('id', pid).maybeSingle();
console.log('SELECT(owner):', own.error ? `ERR ${own.error.code}` : own.data ? 'OK' : 'NO ROW');

for (const [label, op] of [
  ['SELECT', () => B.c.from('projects').select('*').eq('id', pid).maybeSingle()],
  ['UPDATE', () => B.c.from('projects').update({ name: 'HACKED' }).eq('id', pid).select('id').maybeSingle()],
  ['DELETE', () => B.c.from('projects').delete().eq('id', pid).select('id').maybeSingle()],
]) {
  const r = await op();
  const blocked = !r.error && (r.data === null || r.data?.length === 0);
  console.log(`${label}(intruder):`, r.error ? `ERR ${r.error.code}` : blocked ? 'OK BLOCKED (0 rows)' : '!! VIOLATION (row accessible)');
}

const upd = await A.c.from('projects').update({ name: 'My Dream Home (edited by owner)' }).eq('id', pid).select('id,name').maybeSingle();
console.log('UPDATE(owner):', upd.error ? `ERR ${upd.error.code} ${upd.error.message}` : upd.data ? `OK -> ${upd.data.name}` : 'NO ROW');
const del = await A.c.from('projects').delete().eq('id', pid).select('id').maybeSingle();
console.log('DELETE(owner):', del.error ? `ERR ${del.error.code} ${del.error.message}` : del.data ? 'OK cleanup' : 'gone');
console.log('RLS probe done');