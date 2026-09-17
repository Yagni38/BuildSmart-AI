// TEMP DIAGNOSTIC (deleted after use) — decisive probe of the
// customer → contractor assignment flow using ONLY the public anon key.
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

// ---- A) does contractor_profiles.user_id exist live? ----------------------
console.log('== A) contractor_profiles.user_id column? ==');
{
  const anon = createClient(url, key);
  const { data, error } = await anon.from('contractor_profiles').select('user_id').limit(1);
  log('select user_id', error ? `${error.code} ${error.message}` : `exists (rows=${data.length})`);
}

const PASSWORD = 'ProbePass123!';
const stamp = Date.now();
async function ensureUser(email, role, fullName) {
  const c = createClient(url, key);
  const res = await c.auth.signUp({
    email, password: PASSWORD,
    options: { data: { full_name: fullName, role } },
  });
  if (res.error) return { client: c, error: res.error.message, user: null };
  return { client: c, user: res.data.user, error: res.data.user ? null : 'no user returned' };
}

const cust = await ensureUser(`bsa-c-${stamp}@example.com`, 'CUSTOMER', 'Probe C');
const conA = await ensureUser(`bsa-a-${stamp}@example.com`, 'CONTRACTOR', 'Probe A');
const conB = await ensureUser(`bsa-b-${stamp}@example.com`, 'CONTRACTOR', 'Probe B');
console.log('\n== B) temp users ==');
log('customer', cust.error ?? cust.user?.id);
log('contractor A', conA.error ?? conA.user?.id);
log('contractor B', conB.error ?? conB.user?.id);

let projectId = null;

if (cust.user && conA.user && conB.user) {
  console.log('\n== C) customer creates + assigns project (EXACT app update) ==');
  const { data: proj, error: pErr } = await cust.client
    .from('projects')
    .insert({
      customer_id: cust.user.id,
      name: `PROBE ASSIGN ${stamp}`,
      building_type: 'Villa',
      city: 'Bengaluru',
      state: 'Karnataka',
      status: 'PLANNING',
    })
    .select()
    .single();
  log('INSERT project', pErr ? `${pErr.code} ${pErr.message}` : `ok (${proj?.id})`);
  projectId = proj?.id ?? null;

  if (projectId) {
    const nowIso = new Date().toISOString();
    const { data: upd, error: uErr } = await cust.client
      .from('projects')
      .update({ contractor_id: conA.user.id, status: 'CONTRACTOR_SELECTED', updated_at: nowIso })
      .eq('id', projectId)
      .select()
      .single();
    log('UPDATE contractor_id=contractorA.uid', uErr ? `${uErr.code} ${uErr.message}` : 'ok');
    log('persisted contractor_id', upd?.contractor_id ?? 'NULL');
    log('persisted status', upd?.status ?? 'NULL');
    log('uid === persisted?', String(upd?.contractor_id) === String(conA.user.id));

    console.log('\n== D) contractor SELECT (RLS) ==');
    const strict = await conA.client
      .from('projects').select('id, name, status, budget, contractor_id')
      .eq('contractor_id', conA.user.id);
    log('A strict .eq(contractor_id)', strict.error ? `ERROR ${strict.error.code} ${strict.error.message}` : `ok rows=${strict.data.length}`);

    const appQuery = await conA.client
      .from('projects').select('*')
      .or(`contractor_id.eq.${conA.user.id},status.eq.CONTRACTOR_SELECTED,status.eq.IN_PROGRESS`)
      .order('updated_at', { ascending: false });
    log('A app .or() query', appQuery.error ? `ERROR ${appQuery.error.code} ${appQuery.error.message}` : `ok rows=${appQuery.data.length} names=${appQuery.data.map((r) => r.name).join(' | ')}`);

    const other = await conB.client
      .from('projects').select('id, name, contractor_id')
      .eq('contractor_id', conB.user.id);
    log('B strict (must be 0)', other.error ? `ERROR ${other.error.code} ${other.error.message}` : `ok rows=${other.data.length}`);

    const leak = await conB.client
      .from('projects').select('id, name')
      .or(`contractor_id.eq.${conB.user.id},status.eq.CONTRACTOR_SELECTED,status.eq.IN_PROGRESS`);
    log('B app .or() (leak check)', leak.error ? `ERROR ${leak.error.code} ${leak.error.message}` : `rows=${leak.data.length} (0 expected)`);

    console.log('\n== E) milestones / site_logs for assigned contractor ==');
    const m = await conA.client.from('project_milestones').select('id').eq('project_id', projectId);
    log('milestones SELECT', m.error ? `ERROR ${m.error.code} ${m.error.message}` : `ok rows=${m.data.length}`);
    const s = await conA.client.from('site_logs').select('id').eq('project_id', projectId);
    log('site_logs SELECT', s.error ? `ERROR ${s.error.code} ${s.error.message}` : `ok rows=${s.data.length}`);
  }
}

console.log('\n== F) cleanup ==');
if (projectId && cust.client) {
  const { error } = await cust.client.from('projects').delete().eq('id', projectId);
  log('delete probe project', error ? `${error.code} ${error.message}` : 'ok');
}
console.log('== done ==');
