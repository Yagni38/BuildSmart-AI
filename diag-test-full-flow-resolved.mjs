import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const log = (label, data) => console.log(`[PROBE] ${label}:`, data);

async function testFullFlow() {
  const anon = createClient(url, key);

  // 1. Fetch contractor_profiles for vijaya@gmail.com
  const { data: cp } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  log('Vijaya contractor_profiles', { id: cp.id, name: cp.full_name, email: cp.email });

  // 2. Fetch contractor_profiles for another contractor (e.g. Hari)
  const { data: cpOther } = await anon.from('contractor_profiles').select('*').ilike('email', 'hari138@gmail.com').single();
  log('Other contractor_profiles (Hari)', { id: cpOther.id, name: cpOther.full_name, email: cpOther.email });

  // 3. Sign up / in a Customer
  const PASSWORD = 'ProbePassword123!';
  const custEmail = `cust-flow-${Date.now()}@example.com`;
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Flow Customer', role: 'CUSTOMER' } }
  });

  // 4. Customer creates project and selects Vijaya
  const { data: proj, error: pErr } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Residential Villa Construction',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    status: 'PLANNING'
  }).select().single();

  log('Customer created project', { projId: proj.id, err: pErr?.message });

  // Customer selects Vijaya: projects.contractor_id = cp.id
  const { data: assignedProj, error: aErr } = await custClient.from('projects').update({
    contractor_id: cp.id,
    status: 'CONTRACTOR_SELECTED',
    updated_at: new Date().toISOString()
  }).eq('id', proj.id).select().single();

  log('Customer assigned Vijaya', { contractor_id: assignedProj?.contractor_id, status: assignedProj?.status, err: aErr?.message });

  // 5. Test logged-in contractor identity resolution for Vijaya
  // Suppose Vijaya logs in (we sign up a temp user with email = vijaya's email or test user)
  const tempConEmail = `vijaya-auth-${Date.now()}@example.com`;
  // Temporarily update cp.email to tempConEmail so we can sign in as tempConEmail in auth.users
  await anon.from('contractor_profiles').update({ email: tempConEmail }).eq('id', cp.id);

  const vijayaClient = createClient(url, key);
  const { data: vAuth } = await vijayaClient.auth.signUp({
    email: tempConEmail,
    password: PASSWORD,
    options: { data: { full_name: 'vijaya', role: 'CONTRACTOR' } }
  });
  log('Vijaya Auth User ID', vAuth.user?.id);

  // RESOLVE CONTRACTOR IDENTITY:
  // From auth user email (or auth id), resolve contractor_profiles record
  const { data: resolvedCp } = await vijayaClient.from('contractor_profiles').select('id').ilike('email', tempConEmail).maybeSingle();
  log('Resolved contractor_profiles.id', resolvedCp?.id);

  const contractorIds = Array.from(new Set([resolvedCp?.id, vAuth.user.id].filter(Boolean)));
  log('Contractor IDs to query', contractorIds);

  // Query assigned projects for Vijaya
  const { data: vProjects, error: vProjErr } = await vijayaClient.from('projects').select('*').in('contractor_id', contractorIds);
  log('Vijaya Contractor Dashboard Assigned Projects count', vProjects?.length);
  if (vProjects && vProjects.length > 0) {
    log('Assigned Project Name', vProjects[0].name);
    log('Assigned Project Details', { building_type: vProjects[0].building_type, city: vProjects[0].city, contractor_id: vProjects[0].contractor_id });
  } else {
    log('ERROR: Vijaya saw 0 assigned projects!', vProjErr?.message);
  }

  // 6. SECURITY TEST: Test another contractor (Hari) logging in
  const tempHariEmail = `hari-auth-${Date.now()}@example.com`;
  await anon.from('contractor_profiles').update({ email: tempHariEmail }).eq('id', cpOther.id);

  const hariClient = createClient(url, key);
  const { data: hAuth } = await hariClient.auth.signUp({
    email: tempHariEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Hari', role: 'CONTRACTOR' } }
  });

  const { data: hariCp } = await hariClient.from('contractor_profiles').select('id').ilike('email', tempHariEmail).maybeSingle();
  const hariContractorIds = Array.from(new Set([hariCp?.id, hAuth.user.id].filter(Boolean)));

  const { data: hProjects } = await hariClient.from('projects').select('*').in('contractor_id', hariContractorIds);
  log('Hari (Other Contractor) Assigned Projects count (MUST BE 0)', hProjects?.length);

  // Restore original emails
  await anon.from('contractor_profiles').update({ email: 'vijaya@gmail.com' }).eq('id', cp.id);
  await anon.from('contractor_profiles').update({ email: 'hari138@gmail.com' }).eq('id', cpOther.id);

  // Cleanup project
  await custClient.from('projects').delete().eq('id', proj.id);
  log('Cleaned up project', 'OK');
}

testFullFlow();
