// TEMP DIAGNOSTIC (deleted after use) — distinguishes "RLS blocked" from
// "no rows exist" for milestones / site_logs / messages, and verifies whether
// the contractor's project UPDATE actually persists. anon key only.
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

const cust = await signup(`bsmix-cust-${stamp}@example.com`, 'CUSTOMER', 'Mix Customer');
const con = await signup(`bsmix-con-${stamp}@example.com`, 'CONTRACTOR', 'Mix Contractor');
log('customer', cust.error ?? cust.user?.id);
log('contractor', con.error ?? con.user?.id);
if (!cust.user || !con.user) process.exit(0);

const { data: proj, error: pErr } = await cust.client
  .from('projects')
  .insert({ customer_id: cust.user.id, name: `MIX ${stamp}`, status: 'PLANNING' })
  .select()
  .single();
log('customer INSERT project', pErr ? `${pErr.code} ${pErr.message}` : proj?.id);
if (!proj) process.exit(0);

await cust.client
  .from('projects')
  .update({ contractor_id: con.user.id })
  .eq('id', proj.id)
  .select()
  .single();

// --- seed rows AS THE CUSTOMER so "no rows" can be ruled out ---
console.log('\n== seeding as CUSTOMER ==');
{
  const { error } = await cust.client
    .from('project_milestones')
    .insert({ project_id: proj.id, title: 'Seed milestone', percentage: 25, status: 'PENDING' })
    .select('id');
  log('customer INSERT milestone', error ? `${error.code} ${error.message}` : 'ok');
}
{
  const { error } = await cust.client
    .from('site_logs')
    .insert({ project_id: proj.id, contractor_id: con.user.id, description: 'Seed log' })
    .select('id');
  log('customer INSERT site_log', error ? `${error.code} ${error.message}` : 'ok');
}
{
  const { error } = await cust.client
    .from('messages')
    .insert({ project_id: proj.id, sender_id: cust.user.id, content: 'Seed message' })
    .select('id');
  log('customer INSERT message', error ? `${error.code} ${error.message}` : 'ok');
}

// --- now read the SEEDED rows as the CONTRACTOR ---
console.log('\n== CONTRACTOR reads seeded rows ==');
const read = async (label, p) => {
  const { data, error } = await p;
  log(`READ ${label}`, error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
};
await read('project_milestones', con.client.from('project_milestones').select('id, title').eq('project_id', proj.id));
await read('site_logs', con.client.from('site_logs').select('id, description').eq('project_id', proj.id));
await read('messages', con.client.from('messages').select('id, content').eq('project_id', proj.id));

// --- does the contractor's UPDATE actually persist? ---
console.log('\n== contractor project UPDATE persistence ==');
{
  const { data, error } = await con.client
    .from('projects')
    .update({ construction_stage: `ProbeStage ${stamp}` })
    .eq('id', proj.id)
    .select('id');
  log('contractor UPDATE construction_stage', error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`);
}
{
  const { data } = await cust.client
    .from('projects')
    .select('construction_stage')
    .eq('id', proj.id)
    .single();
  log('customer sees stage now', data?.construction_stage ?? 'NULL');
}

// cleanup
await cust.client.from('project_milestones').delete().eq('project_id', proj.id);
await cust.client.from('site_logs').delete().eq('project_id', proj.id);
await cust.client.from('messages').delete().eq('project_id', proj.id);
await cust.client.from('projects').delete().eq('id', proj.id);
log('cleanup', 'done');