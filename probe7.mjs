// TEMP DIAGNOSTIC 7 (deleted after use) — SEED milestones + site_logs as the
// customer, then decide whether the assigned contractor's READ policies are
// missing (0 rows with a seeded row = policy missing) or merely absent rows.
// anon key only, RLS fully enforced.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const PASSWORD = 'ProbePass123!';
const stamp = Date.now();
const log = (l, v) => console.log(`  -> ${l}: ${v}`);

async function mk(email, role, name) {
  const c = createClient(url, key);
  const r = await c.auth.signUp({
    email, password: PASSWORD,
    options: { data: { full_name: name, role } },
  });
  if (r.error) return { c, err: r.error.message };
  return { c, uid: r.data.user?.id };
}

const cust = await mk(`bsq7-cust-${stamp}@example.com`, 'CUSTOMER', 'Q7 Customer');
const con = await mk(`bsq7-con-${stamp}@example.com`, 'CONTRACTOR', 'Q7 Contractor');
log('customer uid', cust.uid ?? cust.err);
log('contractor uid', con.uid ?? con.err);
if (!cust.uid || !con.uid) process.exit(0);

const { data: proj, error: pErr } = await cust.c
  .from('projects')
  .insert({ customer_id: cust.uid, name: `Q7 ${stamp}`, building_type: 'Villa', city: 'Bengaluru' })
  .select('id')
  .single();
log('customer INSERT project', pErr ? `${pErr.code} ${pErr.message}` : proj.id);
if (!proj) process.exit(0);

const { error: asgErr } = await cust.c
  .from('projects')
  .update({ contractor_id: con.uid })
  .eq('id', proj.id)
  .select('id, contractor_id')
  .single();
log('customer ASSIGN', asgErr ? `${asgErr.code} ${asgErr.message}` : 'ok');

// seed as the CUSTOMER — tells us whether customer write policies exist
const { data: ms, error: mErr } = await cust.c
  .from('project_milestones')
  .insert({ project_id: proj.id, title: 'Q7 milestone', percentage: 25, status: 'PENDING' })
  .select('id')
  .single();
log('CUSTOMER insert milestone', mErr ? `${mErr.code} ${mErr.message}` : `ok ${ms.id}`);

const { data: sl, error: sErr } = await cust.c
  .from('site_logs')
  .insert({ project_id: proj.id, contractor_id: con.uid, description: 'Q7 seeded site log' })
  .select('id')
  .single();
log('CUSTOMER insert site_log', sErr ? `${sErr.code} ${sErr.message}` : `ok ${sl.id}`);

// now the contractor tries to READ the seeded rows
console.log('\n== contractor READS of seeded rows ==');
{
  const { data, error } = await con.c.from('project_milestones').select('id').eq('project_id', proj.id);
  log('contractor SELECT milestones', error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
}
{
  const { data, error } = await con.c.from('site_logs').select('id').eq('project_id', proj.id);
  log('contractor SELECT site_logs', error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
}
{
  const { data, error } = await con.c.from('projects').select('id').eq('id', proj.id);
  log('contractor SELECT project by id', error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
}
// customer must still read their own seeded rows
{
  const { data, error } = await cust.c.from('project_milestones').select('id').eq('project_id', proj.id);
  log('customer SELECT milestones (control)', error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
}

// cleanup (customer deletes what it created)
await cust.c.from('site_logs').delete().eq('project_id', proj.id);
await cust.c.from('project_milestones').delete().eq('project_id', proj.id);
await cust.c.from('projects').delete().eq('id', proj.id);
log('cleanup', 'done');
console.log('\n== probe7 complete ==');