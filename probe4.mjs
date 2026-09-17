// TEMP DIAGNOSTIC (deleted after use) — which contractor-side RLS policies are
// MISSING live? Assigns a probe project then checks read/write on every table
// the Contractor Workspace depends on. anon key only, RLS enforced.
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
const log = (l, v) => console.log(`  -> ${l}: ${v}`);
const stamp = Date.now();

async function signup(email, role, fullName) {
  const c = createClient(url, key);
  const res = await c.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: fullName, role } },
  });
  return { client: c, user: res.data?.user, error: res.error?.message ?? null };
}

const cust = await signup(`bsrls-cust-${stamp}@example.com`, 'CUSTOMER', 'RLS Customer');
const con = await signup(`bsrls-con-${stamp}@example.com`, 'CONTRACTOR', 'RLS Contractor');
log('customer', cust.error ?? cust.user?.id);
log('contractor', con.error ?? con.user?.id);
if (!cust.user || !con.user) process.exit(0);

const { data: proj, error: pErr } = await cust.client
  .from('projects')
  .insert({ customer_id: cust.user.id, name: `RLS ${stamp}`, status: 'PLANNING' })
  .select()
  .single();
log('INSERT project', pErr ? `${pErr.code} ${pErr.message}` : proj?.id);
if (!proj) process.exit(0);

const { error: asgErr } = await cust.client
  .from('projects')
  .update({ contractor_id: con.user.id })
  .eq('id', proj.id)
  .select()
  .single();
log('ASSIGN contractor_id', asgErr ? `${asgErr.code} ${asgErr.message}` : 'ok');

const read = async (label, p) => {
  const { data, error } = await p;
  log(`READ  ${label}`, error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
};

console.log('\n== contractor reads (RLS) ==');
await read('projects', con.client.from('projects').select('id').eq('contractor_id', con.user.id));
await read('project_milestones', con.client.from('project_milestones').select('id').eq('project_id', proj.id));
await read('site_logs', con.client.from('site_logs').select('id').eq('project_id', proj.id));
await read('project_updates', con.client.from('project_updates').select('id').eq('project_id', proj.id));
await read('messages', con.client.from('messages').select('id').eq('project_id', proj.id));

console.log('\n== contractor writes (RLS) ==');
{
  const { error } = await con.client
    .from('projects')
    .update({ construction_stage: 'Foundation' })
    .eq('id', proj.id)
    .select('id');
  log('WRITE projects (stage)', error ? `${error.code} ${error.message}` : 'ok');
}
{
  const { error } = await con.client
    .from('project_milestones')
    .insert({ project_id: proj.id, title: 'RLS probe milestone', percentage: 10, status: 'PENDING' })
    .select('id');
  log('WRITE project_milestones', error ? `${error.code} ${error.message}` : 'ok');
}
{
  const { error } = await con.client
    .from('site_logs')
    .insert({ project_id: proj.id, contractor_id: con.user.id, description: 'RLS probe log' })
    .select('id');
  log('WRITE site_logs', error ? `${error.code} ${error.message}` : 'ok');
}

// storage bucket (photo upload path used by the workspace)
{
  const { error } = await con.client.storage.from('site-photos').list(proj.id);
  log('STORAGE list site-photos/<projectId>', error ? `${error.message}` : 'ok');
}

// cleanup
await cust.client.from('project_milestones').delete().eq('project_id', proj.id);
await cust.client.from('site_logs').delete().eq('project_id', proj.id);
await cust.client.from('projects').delete().eq('id', proj.id);
log('cleanup', 'done');