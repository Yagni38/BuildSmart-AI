// PHASE 1 verification — authentication + profile foundation (anon key only).
// Mirrors the repo's existing diag/e2e script pattern. Creates two throwaway
// test accounts (deterministic emails), verifies:
//   1. CUSTOMER: signup -> profiles row (role CUSTOMER) -> login -> session
//      persists (getSession after sign-in) -> logout clears session.
//   2. CONTRACTOR: signup (with registration metadata) -> profiles row
//      (role CONTRACTOR) -> contractor_profiles row auto-created by the DB
//      trigger with id === auth.users.id, experience_years set, PENDING
//      -> owner-RLS read of the own contractor_profiles row (the exact query
//      AuthContext.loadProfile now performs) -> login -> logout.
// No service-role key, no RLS changes, no hard-coded user ids.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') || get('VITE_SUPABASE_PUBLISHABLE_KEY');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
};

const stamp = Date.now();
const custEmail = `phase1-cust-${stamp}@example.com`;
const conEmail = `phase1-con-${stamp}@example.com`;
const PASSWORD = 'phase1-test-1234';

const customer = createClient(url, key);
// ------------------------------------------------------------------ CUSTOMER
console.log('\n== CUSTOMER flow ==');
{
  const { data, error } = await customer.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Phase1 Customer', role: 'CUSTOMER' } },
  });
  check('customer signup', !error, error?.message ?? `uid=${data.user?.id}`);
  check('customer signup returns a session (refresh-persistable)', !!data.session);
  const uid = data.user?.id;

  const { data: prof, error: profErr } = await customer
    .from('profiles').select('id, email, role, full_name').eq('id', uid).maybeSingle();
  check('profiles row exists with id = auth.users.id', !profErr && prof?.id === uid,
    profErr ? `${profErr.code} ${profErr.message}` : `role=${prof?.role}`);
  check('profiles.role === CUSTOMER', prof?.role === 'CUSTOMER');

  const login = await customer.auth.signInWithPassword({ email: custEmail, password: PASSWORD });
  check('customer login', !login.error, login.error?.message);

  const persisted = await customer.auth.getSession();
// ---------------------------------------------------------------- CONTRACTOR
console.log('\n== CONTRACTOR flow ==');
{
  const { data, error } = await contractor.auth.signUp({
    email: conEmail,
    password: PASSWORD,
    options: {
      data: {
        full_name: 'Phase1 Contractor',
        role: 'CONTRACTOR',
        phone: '+91 90000 00000',
        location: 'Bengaluru, Karnataka',
        skills: 'Villa, Structural',
        experience_years: 7,
        project_types: 'Villa, House',
      },
    },
  });
  check('contractor signup', !error, error?.message ?? `uid=${data.user?.id}`);
  const uid = data.user?.id;

  const { data: prof } = await contractor
    .from('profiles').select('id, email, role').eq('id', uid).maybeSingle();
  check('profiles row exists (role CONTRACTOR)', prof?.id === uid && prof?.role === 'CONTRACTOR',
    `role=${prof?.role}`);

  // The signup trigger must auto-create the verification row with
  // id = auth.users.id (NO user_id column) and experience_years from metadata.
  const { data: cp, error: cpErr } = await contractor
    .from('contractor_profiles')
    .select('id, full_name, email, location, skills, experience_years, project_types, resume_url, verification_status')
    .ilike('email', conEmail)
    .maybeSingle();
  check('contractor_profiles row exists (owner-RLS read by email)', !cpErr && !!cp,
    cpErr ? `${cpErr.code} ${cpErr.message}` : 'found');
  check('contractor_profiles.id === auth.users.id (identity)', String(cp?.id) === String(uid),
    `cp.id=${cp?.id} uid=${uid}`);
  check('experience_years populated from registration metadata', Number(cp?.experience_years) === 7,
    `experience_years=${cp?.experience_years}`);
  check('verification_status starts PENDING', String(cp?.verification_status).toUpperCase() === 'PENDING',
    cp?.verification_status);
  check('skills/location/project_types populated',
    cp?.skills === 'Villa, Structural' && cp?.location === 'Bengaluru, Karnataka' &&
      cp?.project_types === 'Villa, House');

  const login = await contractor.auth.signInWithPassword({ email: conEmail, password: PASSWORD });
  check('contractor login', !login.error, login.error?.message);
  const persisted = await contractor.auth.getSession();
  check('contractor session persists (refresh)', !!persisted.data.session);
  await contractor.auth.signOut();
  const after = await contractor.auth.getSession();
  check('contractor logout clears the session', !after.data.session);
}

console.log('\n== ADMIN flow (structural) ==');
console.log('  INFO — admin login requires the pre-provisioned admin account (no public admin signup by design).');
console.log("  INFO — App.roleToRoute.ADMIN -> AdminDashboard + AdminAccessGate(profile.role === 'ADMIN').");

console.log(failures === 0 ? '\nPHASE 1 AUTH VERIFICATION PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

  check('session persists after restore (refresh)', !!persisted.data.session &&
    persisted.data.session.user.id === uid);

  await customer.auth.signOut();
  const after = await customer.auth.getSession();
  check('customer logout clears the session', !after.data.session);
}

const contractor = createClient(url, key);
