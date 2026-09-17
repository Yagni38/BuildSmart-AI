// INTEGRATION end-to-end probe — messages / project_milestones / quotes.
// Uses ONLY the public anon key (RLS enforced). Creates a fresh CUSTOMER +
// ONE project, then probes the REAL capabilities of the three live tables:
//   - which inserts work and which columns are required
//   - which status values the CHECK constraints accept
//   - whether RLS isolates another customer's rows
// Everything created here is DELETED again at the end. No schema changes.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const supabase = createClient(
  get('VITE_SUPABASE_URL'),
  get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY')
);

const stamp = Date.now();
const summary = [];
const note = (label, value) => {
  summary.push(`${label}: ${value}`);
  console.log(`  → ${label}: ${value}`);
};

console.log('== integration probe (messages / milestones / quotes) ==');

// 1) Fresh customer ----------------------------------------------------
const email = `bs-int-${stamp}@example.com`;
const password = 'IntPass123!';
const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: 'Integration Probe', role: 'CUSTOMER' } },
});
if (suErr || !su.session) {
  console.error('SIGNUP ERROR:', suErr?.message ?? 'no session');
  process.exit(1);
}
const uid = su.user.id;
console.log('user:', email, uid);
await new Promise((r) => setTimeout(r, 1500));

// 2) One real project --------------------------------------------------
const { data: project, error: pErr } = await supabase
  .from('projects')
  .insert({
    customer_id: uid,
    name: 'Integration Probe Villa',
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    budget: 4500000,
  })
  .select()
  .single();
if (pErr) {
  console.error('PROJECT INSERT ERROR:', pErr.code, pErr.message);
  process.exit(1);
}
const pid = project.id;
console.log('project:', pid);

// 3) MESSAGES ----------------------------------------------------------
console.log('— messages —');
let msgId = null;
{
  const { data, error } = await supabase
    .from('messages')
    .insert({ project_id: pid, sender_id: uid, message: 'probe: hello' })
    .select()
    .single();
  if (error) note('MESSAGE insert (minimal)', `FAIL ${error.code} ${error.message}`);
  else {
    msgId = data.id;
    note('MESSAGE insert (minimal)', 'OK');
  }
}
{
  const { error } = await supabase
    .from('messages')
    .insert({
      project_id: pid,
      sender_id: uid,
      message: 'probe: with attachment',
      attachment_url: 'https://example.com/quote.pdf',
    })
    .select()
    .single();
  note('MESSAGE insert (attachment_url)', error ? `FAIL ${error.code}` : 'OK');
}
{
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('project_id', pid);
  note('MESSAGE owner select', error ? `FAIL ${error.code}` : `OK (${data.length} rows)`);
}

// 4) Intruder RLS check ------------------------------------------------
{
  const email2 = `bs-int2-${stamp}@example.com`;
  const { data: su2, error: su2Err } = await supabase.auth.signUp({
    email: email2,
    password,
    options: { data: { full_name: 'Integration Intruder', role: 'CUSTOMER' } },
  });

  let intruderClient = null;
  if (!su2Err && su2.session) {
    // Separate client so the intruder's session doesn't clobber the owner's.
    intruderClient = createClient(
      get('VITE_SUPABASE_URL'),
      get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY')
    );
    const { error: sErr } = await intruderClient.auth.signInWithPassword({
      email: email2,
      password,
    });
    if (sErr) intruderClient = null;
  }

  if (intruderClient && msgId) {
    const { data: seen, error: e1 } = await intruderClient
      .from('messages')
      .select('id')
      .eq('project_id', pid);
    const sel = e1 ? `ERR ${e1.code}` : seen.length === 0 ? 'BLOCKED' : `LEAKED ${seen.length}`;
    const { data: upd, error: e2 } = await intruderClient
      .from('messages')
      .update({ message: 'HACKED' })
      .eq('id', msgId)
      .select('id');
    const upd2 = e2 ? `ERR ${e2.code}` : upd.length === 0 ? 'BLOCKED' : 'LEAKED';
    note('MESSAGE intruder SELECT', sel);
    note('MESSAGE intruder UPDATE', upd2);
  } else {
    note('MESSAGE intruder SELECT', 'SKIPPED (no intruder session or no message row)');
    note('MESSAGE intruder UPDATE', 'SKIPPED');
  }
}

// 5) MILESTONES --------------------------------------------------------
console.log('— project_milestones —');
let msId = null;
{
  const variants = [
    { project_id: pid, title: 'Probe Foundation' },
    { project_id: pid, title: 'Probe Foundation', status: 'PENDING' },
    { project_id: pid, title: 'Probe Foundation', status: 'PLANNED' },
    {
      project_id: pid,
      title: 'Probe Foundation',
      status: 'PENDING',
      due_date: '2027-01-15',
      description: 'probe row',
    },
  ];
  let done = false;
  for (const payload of variants) {
    const { data, error } = await supabase
      .from('project_milestones')
      .insert(payload)
      .select()
      .single();
    if (!error) {
      msId = data.id;
      note('MILESTONE insert', `OK with payload keys: ${Object.keys(payload).join(', ')}`);
      note('MILESTONE default status', String(data.status));
      done = true;
      break;
    }
    console.log(`    variant failed: ${error.code} ${error.message}`);
    if (!['23514', '23502', '23503'].includes(error.code)) break;
  }
  if (!done) note('MILESTONE insert', 'FAIL (see variants above)');
}
if (msId) {
  let accepted = 'none';
  for (const s of ['COMPLETED', 'IN_PROGRESS', 'in-progress', 'DONE']) {
    const { error } = await supabase
      .from('project_milestones')
      .update({ status: s, completed_at: new Date().toISOString() })
      .eq('id', msId);
    if (!error) {
      accepted = s;
      break;
    }
    if (error.code !== '23514') {
      accepted = `${s} → unexpected ${error.code} ${error.message}`;
      break;
    }
  }
  note('MILESTONE status update accepted', accepted);
}

// 6) QUOTES ------------------------------------------------------------
console.log('— quotes —');
{
  const { data: contractors } = await supabase.from('contractors').select('id').limit(1);
  const contractorId = contractors?.[0]?.id ?? null;
  note('QUOTE contractor row available', contractorId ? 'yes' : 'NO (contractors empty/anon-blocked)');

  if (contractorId) {
    let ok = false;
    for (const s of ['PENDING', 'pending', 'SENT']) {
      const { error } = await supabase.from('quotes').insert({
        project_id: pid,
        contractor_id: contractorId,
        customer_id: uid,
        amount: 142000,
        description: 'probe plumbing quote',
        status: s,
      });
      if (!error) {
        note('QUOTE insert', `OK (status=${s}, amount accepted)`);
        ok = true;
        break;
      }
      console.log(`    status=${s} failed: ${error.code} ${error.message}`);
      if (error.code !== '23514') break;
    }
    if (!ok) note('QUOTE insert', 'FAIL (see variants above)');
  }
}

// 7) Cleanup -----------------------------------------------------------
console.log('— cleanup —');
{
  if (msgId) {
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    note('cleanup message', error ? `FAIL ${error.message}` : 'ok');
  }
  if (msId) {
    const { error } = await supabase.from('project_milestones').delete().eq('id', msId);
    note('cleanup milestone', error ? `FAIL ${error.message}` : 'ok');
  }
  const { data: qs } = await supabase.from('quotes').select('id').eq('project_id', pid);
  for (const q of qs ?? []) {
    const { error } = await supabase.from('quotes').delete().eq('id', q.id);
    if (error) note('cleanup quote', `FAIL ${error.message}`);
  }
  const { error } = await supabase.from('projects').delete().eq('id', pid);
  note('cleanup project', error ? `FAIL ${error.message}` : 'ok');
}

console.log('\n== SUMMARY ==');
for (const line of summary) console.log(line);
console.log('done');
