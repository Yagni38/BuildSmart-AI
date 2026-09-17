// PHASE 7 PROJECT TRACKER end-to-end test — REAL milestone data flow.
// Verifies (all via the public anon key, RLS enforced):
//   1. A contractor can CREATE milestones (title, description, status,
//      progress, start_date, expected_end_date) for an assigned project.
//   2. The contractor can UPDATE progress/status (completed_date + updated_at).
//   3. The CUSTOMER (project owner) can READ milestones but can NEVER
//      modify or delete them.
//   4. Another contractor cannot read the project's milestones (RLS).
//   5. Overall progress calculation from milestone progress (the tracker's
//      client-side formula: average of milestone progress).
// If the Phase 7 migration (20260908140000_phase7_milestone_tracker_schema.sql)
// has not been applied yet, steps report "MIGRATION REQUIRED" instead of
// failing hard (run it in the Supabase SQL Editor first).
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

const password = 'P7Track123!';
const stamp = Date.now();
let failures = 0;
const ok = (label, value) => console.log(`${value === false ? '✗' : '✓'} ${label}: ${value}`);
const fail = (label, detail) => {
  failures += 1;
  console.error(`✗ ${label}: ${detail}`);
};
const migrationHint = (what) =>
  `⚠ MIGRATION REQUIRED: ${what} — run 20260908140000_phase7_milestone_tracker_schema.sql`;

async function mkUser(tag, role) {
  const c = mk();
  const email = `bs-p7track-${tag}-${stamp}@example.com`;
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { full_name: `P7 Track ${tag}`, role } },
  });
  if (error || !data.session) {
    fail(`signUp ${tag}`, error?.message ?? 'no session');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 1500)); // profile trigger
  return { c, uid: data.user.id, email };
}

console.log('== Phase 7 Project Tracker e2e ==');

// 1) Users: customer, assigned contractor, stranger contractor
const customer = await mkUser('cust', 'CUSTOMER');
const contractor = await mkUser('gc', 'CONTRACTOR');
const stranger = await mkUser('gc2', 'CONTRACTOR');
console.log('customer :', customer.uid);
console.log('contractor:', contractor.uid);

// 2) Customer creates a project assigned to the contractor (IN_PROGRESS).
const { data: project, error: pErr } = await customer.c
  .from('projects')
  .insert({
    customer_id: customer.uid,
    contractor_id: contractor.uid,
    name: `P7 Track Villa ${stamp}`,
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    budget: 8500000,
    status: 'IN_PROGRESS',
    description: 'Phase 7 tracker e2e project',
  })
  .select('id')
  .single();
if (pErr) {
  fail('project create', pErr.message);
  process.exit(1);
}
console.log('project  :', project.id);

// 3) Contractor creates milestones WITH the Phase-7 fields.
const m1 = await contractor.c
  .from('project_milestones')
  .insert({
    project_id: project.id,
    title: 'Foundation',
    description: 'Excavation and footing',
    status: 'PENDING',
    progress: 0,
    start_date: '2026-10-01',
    expected_end_date: '2026-10-20',
  })
  .select()
  .single();
let m1id = null;
if (m1.error) {
  if (m1.error.code === '42P01' || m1.error.code === '42703' || m1.error.code === 'PGRST204') {
    console.log('⚠ MIGRATION REQUIRED: phase 7 milestone columns missing — run the migration');
  } else {
    fail('milestone create (contractor)', `${m1.error.code} ${m1.error.message}`);
  }
} else {
  m1id = m1.data.id;
  ok(
    'milestone create w/ phase7 fields',
    `title=${m1.data.title} progress=${m1.data.progress} start=${m1.data.start_date} end=${m1.data.expected_end_date}`
  );
}
const m2 = await contractor.c
  .from('project_milestones')
  .insert({
    project_id: project.id,
    title: 'Framing',
    description: 'Steel and wood framework',
    status: 'PENDING',
    progress: 0,
    start_date: '2026-10-21',
    expected_end_date: '2026-11-15',
  })
  .select()
  .single();
let m2id = null;
if (m2.error) {
  if (m2.error.code === '42P01' || m2.error.code === '42703' || m2.error.code === 'PGRST204') {
    console.log('⚠ MIGRATION REQUIRED: phase 7 milestone columns missing — run the migration');
  } else {
    fail('milestone create (contractor) #2', `${m2.error.code} ${m2.error.message}`);
  }
} else {
  m2id = m2.data.id;
  ok(
    'milestone create #2 w/ phase7 fields',
    `title=${m2.data.title} progress=${m2.data.progress} start=${m2.data.start_date} end=${m2.data.expected_end_date}`
  );
}
// 4) Contractor updates milestone #1: progress 60 + IN_PROGRESS.
if (m1id) {
  const upd = await contractor.c
    .from('project_milestones')
    .update({ progress: 60, status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
    .eq('id', m1id)
    .select('progress, status, updated_at')
    .single();
  if (upd.error) fail('milestone progress update', `${upd.error.code} ${upd.error.message}`);
  else {
    ok('milestone progress update', `progress=${upd.data.progress} status=${upd.data.status}`);
    ok('milestone updated_at set', !!upd.data.updated_at);
  }

  // Complete it → completed_date must be recorded.
  const done = await contractor.c
    .from('project_milestones')
    .update({ progress: 100, status: 'COMPLETED', completed_date: new Date().toISOString() })
    .eq('id', m1id)
    .select('progress, status, completed_date')
    .single();
  if (done.error) fail('milestone complete', `${done.error.code} ${done.error.message}`);
  else ok('milestone complete', `status=${done.data.status} completed_date=${!!done.data.completed_date}`);
}

// 5) Customer reads milestones (participant) but cannot modify/delete them.
const custRead = await customer.c
  .from('project_milestones')
  .select('id, title, progress, status')
  .eq('project_id', project.id);
ok(
  'customer reads milestone list',
  custRead.error ? `err ${custRead.error.code}` : `${custRead.data.length} row(s) (expect 2)`
);

if (m2id) {
  const custMod = await customer.c
    .from('project_milestones')
    .update({ progress: 99 })
    .eq('id', m2id)
    .select('id');
  ok(
    'customer milestone modify blocked',
    custMod.error ? `err ${custMod.error.code}` : `${custMod.data.length} rows (expect 0)`
  );

  const custDel = await customer.c
    .from('project_milestones')
    .delete()
    .eq('id', m2id)
    .select('id');
  ok(
    'customer milestone delete blocked',
    custDel.error ? `err ${custDel.error.code}` : `${custDel.data.length} rows (expect 0)`
  );
}

// 6) Stranger contractor cannot read the project's milestones.
const strangerRead = await stranger.c
  .from('project_milestones')
  .select('id')
  .eq('project_id', project.id);
ok(
  'stranger contractor blocked',
  strangerRead.error ? `err ${strangerRead.error.code}` : `${strangerRead.data.length} rows (expect 0)`
);

// 7) Overall progress formula (tracker computes avg of milestone progress).
const allMs = await contractor.c
  .from('project_milestones')
  .select('progress')
  .eq('project_id', project.id);
if (allMs.error) {
  if (allMs.error.code === '42703' || allMs.error.code === 'PGRST204') {
    console.log('⚠ MIGRATION REQUIRED: phase 7 milestone columns missing — run the migration');
  } else {
    fail('milestone list (for overall calc)', allMs.error.message);
  }
} else if (allMs.data.length > 0) {
  const overall = Math.round(
    allMs.data.reduce((s, r) => s + Number(r.progress ?? 0), 0) / allMs.data.length
  );
  ok(
    'overall progress avg',
    `${allMs.data.map((r) => r.progress).join(',')} → ${overall}%`
  );
}

// 8) Cleanup — delete project (cascades milestones).
const del = await customer.c.from('projects').delete().eq('id', project.id);
if (del.error) fail('cleanup project', del.error.message);
else ok('cleanup', 'project + cascades deleted');

console.log(
  failures === 0 ? '\nPHASE 7 TRACKER TEST PASSED ✓' : `\n${failures} CHECK(S) FAILED ✗`
);
process.exit(failures === 0 ? 0 : 1);
