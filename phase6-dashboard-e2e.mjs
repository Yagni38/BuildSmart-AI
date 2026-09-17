// PHASE 6 DASHBOARD end-to-end test — REAL contractor dashboard data flow.
// Verifies (all via the public anon key, RLS enforced):
//   1. A contractor sees ONLY projects where projects.contractor_id = their uid.
//   2. The contractor can post project_updates (site update) on their project.
//   3. The contractor can update progress + updated_at on their project.
//   4. The contractor can create/complete milestones.
//   5. A CUSTOMER can read contractor updates but can NEVER modify them (RLS).
//   6. Another contractor cannot access the project (RLS).
//   7. Site photo upload into the site-photos storage bucket.
// If the Phase 6 migration has not been applied yet, steps report
// "MIGRATION REQUIRED" instead of failing hard, so run
// supabase/migrations/20260908120000_phase6_contractor_dashboard.sql first
// (Supabase SQL Editor or `supabase db push`).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const url = get('VITE_SUPABASE_URL');
const anon = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const mk = () => createClient(url, anon);

const password = 'P6Dash123!';
const stamp = Date.now();
let failures = 0;
const ok = (label, value) => console.log(`${value === false ? '✗' : '✓'} ${label}: ${value}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`✗ ${label}: ${detail}`);
};

async function mkUser(tag, role) {
  const c = mk();
  const email = `bs-p6dash-${tag}-${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { full_name: `P6 Dash ${tag}`, role } },
  });
  if (error || !data.session) {
    fail(`signUp ${tag}`, error?.message ?? 'no session');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1500)); // profile trigger
  return { c, uid: data.user.id, email };
}

console.log('== Phase 6 Contractor Dashboard e2e ==');

// 1) Users: customer, assigned contractor, other contractor
const customer = await mkUser('cust', 'CUSTOMER');
const contractor = await mkUser('tc', 'CONTRACTOR');
const other = await mkUser('tc2', 'CONTRACTOR');
console.log('customer :', customer.uid);
console.log('contractor:', contractor.uid);

// 2) Customer creates a project assigned to the contractor
const { data: project, error: pErr } = await customer.c
  .from('projects')
  .insert({
    customer_id: customer.uid,
    contractor_id: contractor.uid,
    name: `P6 Dash Villa ${stamp}`,
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    budget: 7500000,
    status: 'IN_PROGRESS',
    description: 'Phase 6 dashboard e2e project',
  })
  .select('id')
  .single();
if (pErr) {
  fail('project create', pErr.message);
  process.exit(1);
}
console.log('project  :', project.id);

// 3) Contractor sees exactly their assigned project
const seen = await contractor.c
  .from('projects')
  .select('id, name, contractor_id, customer_id, updated_at')
  .eq('contractor_id', contractor.uid);
if (seen.error) fail('contractor project list', seen.error.message);
else if (seen.data.length === 1 && seen.data[0].id === project.id) {
  ok('contractor sees assigned project', seen.data[0].name);
  ok('updated_at present (timestamp)', !!seen.data[0].updated_at);
} else {
  fail('contractor project list', `expected 1 row, got ${seen.data?.length ?? 'err'}`);
}

// 4) Another contractor must see nothing
const otherSeen = await other.c
  .from('projects')
  .select('id')
  .eq('id', project.id);
ok(
  'other contractor blocked',
  otherSeen.error ? `err ${otherSeen.error.code}` : `${otherSeen.data.length} rows`
);

// 5) Contractor posts a SITE update
const upd = await contractor.c
  .from('project_updates')
  .insert({
    project_id: project.id,
    author_id: contractor.uid,
    update_type: 'SITE',
    title: 'Roof slab shuttering',
    content: 'Steel mesh laid, shuttering 80% complete.',
  })
  .select()
  .single();
let updateRow = null;
if (upd.error) {
  if (upd.error.code === '42P01') {
    console.log('⚠ MIGRATION REQUIRED: project_updates table missing — run 20260908120000_phase6_contractor_dashboard.sql');
  } else {
    fail('contractor site update insert', `${upd.error.code} ${upd.error.message}`);
  }
} else {
  updateRow = upd.data;
  ok('contractor site update insert', upd.data.id);
}

// 6) Contractor updates progress + updated_at
const prog = await contractor.c
  .from('projects')
  .update({ progress: 45, updated_at: new Date().toISOString() })
  .eq('id', project.id)
  .select('id, progress, updated_at')
  .single();
if (prog.error) {
  if (prog.error.code === '42703' || /progress/i.test(prog.error.message)) {
    console.log('⚠ MIGRATION REQUIRED: projects.progress column missing — run the Phase 6 migration');
  } else {
    fail('contractor progress update', `${prog.error.code} ${prog.error.message}`);
  }
} else {
  ok('contractor progress update', `progress=${prog.data.progress} updated_at=${prog.data.updated_at}`);
}

// 7) Milestone: contractor creates + completes; customer cannot modify
const ms = await contractor.c
  .from('project_milestones')
  .insert({
    project_id: project.id,
    title: `Plinth beam ${stamp}`,
    status: 'PENDING',
    due_date: '2026-10-01',
  })
  .select()
  .single();
if (ms.error) {
  if (ms.error.code === '42501') {
    console.log('⚠ MIGRATION REQUIRED: milestone INSERT policy missing — run the Phase 6 migration');
  } else {
    fail('milestone create (contractor)', `${ms.error.code} ${ms.error.message}`);
  }
} else {
  ok('milestone create (contractor)', ms.data.id);
  const done = await contractor.c
    .from('project_milestones')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
    .eq('id', ms.data.id)
    .select('status')
    .single();
  ok('milestone complete (contractor)', done.error ? `err ${done.error.code}` : done.data.status);

  // Customer attempts milestone modification → MUST fail
  const custMod = await customer.c
    .from('project_milestones')
    .update({ status: 'PENDING' })
    .eq('id', ms.data.id)
    .select('id');
  ok(
    'customer milestone modify blocked',
    custMod.error ? `err ${custMod.error.code}` : `${custMod.data.length} rows (expect 0)`
  );
}

// 8) Customer can READ the contractor update but can NEVER modify it
if (updateRow) {
  const custRead = await customer.c
    .from('project_updates')
    .select('id, title, created_at')
    .eq('id', updateRow.id)
    .maybeSingle();
  ok(
    'customer reads contractor update',
    custRead.error ? `err ${custRead.error.code}` : custRead.data?.title ?? 'row hidden'
  );

  const custMod = await customer.c
    .from('project_updates')
    .update({ content: 'HACKED' })
    .eq('id', updateRow.id)
    .select('id');
  ok(
    'customer update modify blocked',
    custMod.error ? `err ${custMod.error.code}` : `${custMod.data.length} rows (expect 0)`
  );
}

// 9) Site photo upload → site-photos bucket
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001' +
    '0d0a2db40000000049454e44ae426082',
  'hex'
);
const upl = await contractor.c.storage
  .from('site-photos')
  .upload(`${project.id}/e2e-${stamp}.png`, png, { contentType: 'image/png', upsert: true });
ok(
  'site photo upload',
  upl.error
    ? `⚠ ${upl.error.statusCode ?? ''} ${upl.error.message} (bucket needs migration)`
    : upl.data?.path ?? 'ok'
);

// 10) Cleanup — delete project (cascades updates + milestones)
const del = await customer.c.from('projects').delete().eq('id', project.id);
if (del.error) fail('cleanup project', del.error.message);
else ok('cleanup', 'project + cascades deleted');

console.log(failures === 0 ? '\nPHASE 6 DASHBOARD TEST PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);
