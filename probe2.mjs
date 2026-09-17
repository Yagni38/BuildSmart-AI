// TEMP DIAGNOSTIC (deleted after use) — which statuses does the LIVE
// projects_status_check allow, and does assignment+SELECT work end-to-end?
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const log = (l, v) => console.log(`  -> ${l}: ${v}`);
const stamp = Date.now();
const PASSWORD = 'ProbePass123!';

async function mkUser(email, role, fullName) {
  const c = createClient(url, key);
  const res = await c.auth.signUp({
    email, password: PASSWORD,
    options: { data: { full_name: fullName, role } },
  });
  return { client: c, user: res.data?.user ?? null, error: res.error?.message ?? null };
}

const cust = await mkUser(`bst-c-${stamp}@example.com`, 'CUSTOMER', 'PC');
const conA = await mkUser(`bst-a-${stamp}@example.com`, 'CONTRACTOR', 'PA');
const conB = await mkUser(`bst-b-${stamp}@example.com`, 'CONTRACTOR', 'PB');
console.log('== users ==');
log('customer', cust.error ?? cust.user?.id);
log('contractor A', conA.error ?? conA.user?.id);
log('contractor B', conB.error ?? conB.user?.id);

let pid = null;

if (cust.user && conA.user && conB.user) {
  const { data: proj, error: pe } = await cust.client
    .from('projects')
    .insert({ customer_id: cust.user.id, name: `STATUS PROBE ${stamp}`, building_type: 'Villa', city: 'Bengaluru', state: 'Karnataka', status: 'PLANNING' })
    .select().single();
  log('INSERT', pe ? `${pe.code} ${pe.message}` : `ok ${proj?.id}`);
  pid = proj?.id ?? null;

  if (pid) {
    console.log('\n== allowed status values on UPDATE ==');
    const candidates = ['CONTRACTOR_SELECTED', 'IN_PROGRESS', 'ACTIVE_BUILD', 'ON_HOLD', 'SUBMITTED', 'DRAFT', 'PLANNING', 'COMPLETED', 'CANCELLED'];
    let firstAllowed = null;
    for (const s of candidates) {
      const { error } = await cust.client.from('projects').update({ status: s }).eq('id', pid).select().single();
      const ok = !error;
      log(s, ok ? 'ALLOWED' : `${error.code}`);
      if (ok && !firstAllowed) firstAllowed = s;
    }
    log('firstAllowed', firstAllowed);

    console.log('\n== real assignment (contractor_id only, no status) ==');
    const { data: u1, error: e1 } = await cust.client
      .from('projects')
      .update({ contractor_id: conA.user.id, updated_at: new Date().toISOString() })
      .eq('id', pid).select().single();
    log('UPDATE contractor_id only', e1 ? `${e1.code} ${e1.message}` : 'ok');
    log('persisted', u1?.contractor_id ?? 'NULL');
    log('matches A uid?', String(u1?.contractor_id) === String(conA.user.id));

    console.log('\n== contractor A reads (RLS) ==');
    const strictA = await conA.client.from('projects').select('id, name, status, budget, contractor_id').eq('contractor_id', conA.user.id);
    log('A .eq(contractor_id=A.uid)', strictA.error ? `ERROR ${strictA.error.code}` : `rows=${strictA.data.length}`);

    const inQuery = await conA.client.from('projects').select('id, name').in('contractor_id', [conA.user.id]);
    log('A .in([uid])', inQuery.error ? `ERROR ${inQuery.error.code}` : `rows=${inQuery.data.length}`);

    const appOr = await conA.client.from('projects').select('id, name, contractor_id')
      .or(`contractor_id.eq.${conA.user.id},status.eq.CONTRACTOR_SELECTED,status.eq.IN_PROGRESS`);
    log('A app .or()', appOr.error ? `ERROR ${appOr.error.code}` : `rows=${appOr.data.length}`);

    const strictB = await conB.client.from('projects').select('id, name').eq('contractor_id', conB.user.id);
    log('B .eq(contractor_id=B.uid) [must be 0]', strictB.error ? `ERROR ${strictB.error.code}` : `rows=${strictB.data.length}`);

    const leakB = await conB.client.from('projects').select('id, name')
      .or(`contractor_id.eq.${conB.user.id},status.eq.CONTRACTOR_SELECTED,status.eq.IN_PROGRESS`);
    log('B app .or() [must be 0]', leakB.error ? `ERROR ${leakB.error.code}` : `rows=${leakB.data.length}`);

    console.log('\n== contractor A cp row (email identity) ==');
    const cpHit = await conA.client.from('contractor_profiles').select('id, email, verification_status').eq('email', `bst-a-${stamp}@example.com`);
    log('own cp row', cpHit.error ? `ERROR ${cpHit.error.code} ${cpHit.error.message}` : JSON.stringify(cpHit.data));
    log('cp.id === A.uid?', cpHit.data?.[0] ? String(cpHit.data[0].id) === String(conA.user.id) : 'n/a');
  }
}

console.log('\n== cleanup ==');
if (pid) {
  const { error } = await cust.client.from('projects').delete().eq('id', pid);
  log('delete probe project', error ? `${error.code}` : 'ok');
}
console.log('== done ==');