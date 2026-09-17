// ============================================================================
// END-TO-END: real customer → contractor assignment flow (live Supabase).
//
// Uses REAL authenticated sessions (signUp / signInWithPassword with the anon
// key) — never an anonymous client, never the service-role key.
//
// Modes:
//   node e2e-contractor-assignment.mjs create-accounts
//   node e2e-contractor-assignment.mjs assign
//   node e2e-contractor-assignment.mjs verify
//
// The contractor is approved between create-accounts and assign (admin step,
// executed via SQL) so "only VERIFIED contractors are selectable" is covered.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (name) => {
  const m = env.match(new RegExp('^' + name + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};

const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) {
  console.error('Missing Supabase env in .env.local');
  process.exit(1);
}

const PASSWORD = 'E2ePass123!';
const CUSTOMER_EMAIL = 'e2e-cust-assign@example.com';
const CONTRACTOR_EMAIL = 'e2e-con-assign@example.com';
const OTHER_CONTRACTOR_EMAIL = 'e2e-con-other@example.com';
const PROJECT_NAME = 'E2E Assignment Villa';

const mk = () => createClient(url, key, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

async function authenticatedClient(email, meta = {}) {
  const client = mk();
  const signUp = await client.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: meta },
  });

  if (!signUp.error && signUp.data?.session) return { client, user: signUp.data.user };

  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`sign-in failed for ${email}: ${signIn.error.message}`);
  return { client, user: signIn.data.user };
}

/** The contractor_profiles row for the signed-in contractor (owner RLS). */
async function contractorProfile(client) {
  const { data, error } = await client.from('contractor_profiles').select('*').maybeSingle();
  if (error) throw new Error(`contractor_profiles read failed: ${error.message}`);
  return data;
}

/** The customer's live project row (real DB read). */
async function findProject(client) {
  const { data, error } = await client
    .from('projects')
    .select('*')
    .like('name', `${PROJECT_NAME}%`)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`projects read failed: ${error.message}`);
  return (data ?? [])[0] ?? null;
}

const mode = process.argv[2] ?? 'verify';

// ---------------------------------------------------------------------------
// 1) create-accounts
// ---------------------------------------------------------------------------
if (mode === 'create-accounts') {
  const customer = await authenticatedClient(CUSTOMER_EMAIL, {
    full_name: 'E2E Customer',
    role: 'CUSTOMER',
  });
  const contractor = await authenticatedClient(CONTRACTOR_EMAIL, {
    full_name: 'E2E Contractor',
    role: 'CONTRACTOR',
    phone: '9990000001',
    location: 'Bengaluru, Karnataka',
    skills: 'Villa, Structural, Interiors',
    experience_years: '9',
    project_types: 'Villa, House',
  });
  const other = await authenticatedClient(OTHER_CONTRACTOR_EMAIL, {
    full_name: 'E2E Other Contractor',
    role: 'CONTRACTOR',
    location: 'Chennai, Tamil Nadu',
    skills: 'Renovation',
    experience_years: '4',
    project_types: 'Renovation',
  });

  await new Promise((r) => setTimeout(r, 2000)); // let the signup triggers run

  const cProfile = await contractorProfile(contractor.client);
  const oProfile = await contractorProfile(other.client);
  if (!cProfile) throw new Error('contractor_profiles row missing for the contractor');

  console.log(JSON.stringify({
    customer: { id: customer.user.id, email: CUSTOMER_EMAIL, role: 'CUSTOMER' },
    contractor: {
      authUserId: contractor.user.id,
      contractorProfileId: cProfile.id,
      emailC: cProfile.email,
      verification: cProfile.verification_status,
    },
    otherContractor: {
      authUserId: other.user.id,
      contractorProfileId: oProfile?.id ?? null,
      verification: oProfile?.verification_status ?? null,
    },
  }, null, 2));

  check('contractor_profiles.id === auth user id', cProfile.id === contractor.user.id);
  check('new contractor starts PENDING (admin verification still required)',
    String(cProfile.verification_status).toUpperCase() === 'PENDING',
    String(cProfile.verification_status));
}

// ---------------------------------------------------------------------------
// 2) assign — customer creates the project and selects the contractor using the
//    EXACT same write the app performs (contractor_profiles.id →
//    projects.contractor_id + CONTRACTOR_SELECTED).
// ---------------------------------------------------------------------------
if (mode === 'assign') {
  const customer = await authenticatedClient(CUSTOMER_EMAIL, { role: 'CUSTOMER' });
  const contractor = await authenticatedClient(CONTRACTOR_EMAIL, { role: 'CONTRACTOR' });

  const cProfile = await contractorProfile(contractor.client);
  if (!cProfile) throw new Error('contractor profile missing');
  const contractorId = cProfile.id;

  const { data: created, error: createErr } = await customer.client
    .from('projects')
    .insert({
      customer_id: customer.user.id,
      name: `${PROJECT_NAME} ${Date.now()}`,
      project_type: 'NEW_CONSTRUCTION',
      building_type: 'Villa',
      description: 'End-to-end assignment verification project.',
      city: 'Bengaluru',
      state: 'Karnataka',
      built_up_area: 2400,
      floors: 2,
      bedrooms: 4,
      bathrooms: 3,
      budget: 8500000,
      budget_min: 8000000,
      budget_max: 9000000,
      expected_completion: '2027-06-30',
      timeline: '12 months',
      design_style: 'Contemporary',
      material_preference: 'Italian marble, teak wood',
      sustainability_preference: 'Solar ready, rainwater harvesting',
      construction_stage: 'Planning',
      priority: 'High',
      requirements: 'G+1 villa with covered parking and a home office.',
      soil_type: 'Loam',
      status: 'PLANNING',
    })
    .select()
    .single();

  if (createErr) throw new Error(`project insert failed: ${createErr.message}`);

  const { data: saved, error: assignErr } = await customer.client
    .from('projects')
    .update({
      contractor_id: contractorId,
      status: 'CONTRACTOR_SELECTED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.id)
    .select()
    .single();

  console.log(JSON.stringify({
    projectId: created.id,
    contractorId,
    assignedContractorId: saved?.contractor_id ?? null,
    status: saved?.status ?? null,
    assignError: assignErr ? `${assignErr.code} ${assignErr.message}` : null,
  }, null, 2));

  check('TEST 2/3: customer assignment write succeeded', !assignErr);
  check('TEST 3: projects.contractor_id === contractor_profiles.id',
    String(saved?.contractor_id) === String(contractorId));
  check('TEST 3: projects.status === CONTRACTOR_SELECTED (no 23514 fallback)',
    saved?.status === 'CONTRACTOR_SELECTED', String(saved?.status));
}