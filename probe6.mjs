// TEMP DIAGNOSTIC (deleted after use) — (a) full LIVE schema inventory via
// PostgREST OpenAPI, (b) live RLS helper behaviour via RPC, (c) contractor
// SELECT check. anon key only. Deterministic emails so re-runs reuse users.
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

// ---------- (a) LIVE schema inventory ----------
console.log('== A) LIVE schema (PostgREST OpenAPI) ==');
try {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
  const spec = await res.json();
  const defs = spec.definitions ?? {};
  const names = Object.keys(defs).sort();
  log('tables', names.length);
  console.log(`     ${names.join(', ')}`);

  const show = (t, want) => {
    const cols = defs[t] ? Object.keys(defs[t].properties ?? {}) : null;
    if (!cols) return log(`${t}`, 'DOES NOT EXIST');
    const present = want.map((c) => `${c}${cols.includes(c) ? '' : ''}`);
    log(`${t} cols`, present.join(' '));
  };
  show('projects', ['id', 'customer_id', 'contractor_id', 'status', 'construction_stage', 'progress', 'start_date', 'selected_at', 'budget']);
  show('contractor_profiles', ['id', 'user_id', 'email', 'verification_status']);
  show('profiles', ['id', 'role', 'verification_status']);
  show('project_milestones', ['id', 'project_id', 'status', 'percentage']);
  show('site_logs', ['id', 'project_id', 'contractor_id']);
} catch (e) {
  log('OpenAPI fetch failed', e.message);
}

// ---------- (b)+(c) live RLS behaviour ----------
const PW = 'ProbePass123!';
async function ensure(email, role, fullName) {
  const c = createClient(url, key);
  let r = await c.auth.signUp({
    email,
    password: PW,
    options: { data: { full_name: fullName, role } },
  });
  if (r.error || !r.data?.user) {
    r = await c.auth.signInWithPassword({ email, password: PW });
  }
  return { client: c, user: r.data?.user, error: r.error?.message ?? (r.data?.user ? null : 'no user') };
}

console.log('\n== B) live RLS helpers + contractor SELECT ==');
const cust = await ensure('bsfix-cust@example.com', 'CUSTOMER', 'Fix Probe Customer');
const con = await ensure('bsfix-con@example.com', 'CONTRACTOR', 'Fix Probe Contractor');
const conB = await ensure('bsfix-con2@example.com', 'CONTRACTOR', 'Fix Probe Contractor 2');
log('customer', cust.error ?? cust.user?.id);
log('contractor A', con.error ?? con.user?.id);
log('contractor B', conB.error ?? conB.user?.id);

if (cust.user && con.user) {
  const { data: proj, error: pErr } = await cust.client
    .from('projects')
    .insert({ customer_id: cust.user.id, name: 'FIX PROBE', building_type: 'Villa', status: 'PLANNING' })
    .select()
    .single();
  log('customer INSERT project', pErr ? `${pErr.code} ${pErr.message}` : proj?.id);

  if (proj?.id) {
    const { error: asgErr } = await cust.client
      .from('projects')
      .update({ contractor_id: con.user.id })
      .eq('id', proj.id)
      .select()
      .single();
    log('assign contractor_id', asgErr ? `${asgErr.code} ${asgErr.message}` : 'ok (row returned)');

    for (const fn of ['is_assigned_contractor', 'is_project_participant', 'is_assigned_contractor_for_customer']) {
      const arg = fn === 'is_assigned_contractor_for_customer' ? { p_customer_id: cust.user.id } : { p_project_id: proj.id };
      const { data, error } = await con.client.rpc(fn, arg);
      log(`rpc ${fn}(A)`, error ? `${error.code} ${error.message}` : `=> ${data}`);
    }

    const { data: selA, error: selAErr } = await con.client
      .from('projects')
      .select('id')
      .eq('contractor_id', con.user.id);
    log('A SELECT eq(contractor_id)', selAErr ? `${selAErr.code} ${selAErr.message}` : `rows=${selA?.length ?? 0}`);

    const { data: selAll } = await con.client.from('projects').select('id');
    log('A SELECT unfiltered (RLS-only)', `rows=${selAll?.length ?? 0}`);

    const { error: dErr } = await cust.client.from('projects').delete().eq('id', proj.id);
    log('cleanup', dErr ? `${dErr.code} ${dErr.message}` : 'ok');
  }
}
console.log('\n== probe complete ==');