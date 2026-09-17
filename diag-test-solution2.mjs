import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const log = (label, data) => console.log(`[TEST] ${label}:`, data);

async function testSolution2() {
  const PASSWORD = 'TestPassword123!';
  const stamp = Date.now();
  const vijayaEmail = `vijaya-test-${stamp}@example.com`;
  const hariEmail = `hari-test-${stamp}@example.com`;
  const custEmail = `cust-sol2-${stamp}@example.com`;

  // 1. Sign up Vijaya as CONTRACTOR in auth.users
  const vijayaClient = createClient(url, key);
  const { data: vAuth, error: vAuthErr } = await vijayaClient.auth.signUp({
    email: vijayaEmail,
    password: PASSWORD,
    options: { data: { full_name: 'vijaya', role: 'CONTRACTOR' } }
  });
  log('Vijaya Auth User', { id: vAuth.user?.id, email: vAuth.user?.email, err: vAuthErr?.message });

  // 2. Sign up Hari as CONTRACTOR in auth.users
  const hariClient = createClient(url, key);
  const { data: hAuth, error: hAuthErr } = await hariClient.auth.signUp({
    email: hariEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Hari', role: 'CONTRACTOR' } }
  });
  log('Hari Auth User', { id: hAuth.user?.id, email: hAuth.user?.email, err: hAuthErr?.message });

  // 3. Check trigger-created contractor_profiles for Vijaya & update verification_status to VERIFIED
  let { data: cpVijaya } = await vijayaClient.from('contractor_profiles').select('*').ilike('email', vijayaEmail).single();
  if (!cpVijaya) {
    const { data: ins } = await vijayaClient.from('contractor_profiles').upsert({
      id: vAuth.user.id,
      full_name: 'vijaya',
      email: vijayaEmail,
      verification_status: 'VERIFIED'
    }).select().single();
    cpVijaya = ins;
  } else {
    const { data: upd } = await vijayaClient.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpVijaya.id).select().single();
    if (upd) cpVijaya = upd;
  }
  log('Vijaya contractor_profiles', { id: cpVijaya?.id, email: cpVijaya?.email, status: cpVijaya?.verification_status });

  // 4. Check trigger-created contractor_profiles for Hari
  let { data: cpHari } = await hariClient.from('contractor_profiles').select('*').ilike('email', hariEmail).single();
  if (!cpHari) {
    const { data: ins } = await hariClient.from('contractor_profiles').upsert({
      id: hAuth.user.id,
      full_name: 'Hari',
      email: hariEmail,
      verification_status: 'VERIFIED'
    }).select().single();
    cpHari = ins;
  } else {
    const { data: upd } = await hariClient.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpHari.id).select().single();
    if (upd) cpHari = upd;
  }
  log('Hari contractor_profiles', { id: cpHari?.id, email: cpHari?.email });

  // 5. Customer signs up & creates project assigned to cpVijaya.id
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Solution Customer 2', role: 'CUSTOMER' } }
  });

  const { data: proj, error: pErr } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Modern Villa Project for Vijaya',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    built_up_area: 2800,
    floors: 2,
    bedrooms: 4,
    bathrooms: 4,
    budget: 8500000,
    contractor_id: cpVijaya.id,
    status: 'CONTRACTOR_SELECTED'
  }).select().single();

  log('Customer created project assigned to cpVijaya.id', { id: proj?.id, contractor_id: proj?.contractor_id, err: pErr?.message });

  // 6. TEST CONTRACTOR DASHBOARD QUERY FOR VIJAYA (authenticated as vijayaClient)
  async function getContractorProjects(client, userEmail, userId) {
    // Resolve contractor profile id from authenticated email or userId
    const { data: cpRow } = await client.from('contractor_profiles').select('id').ilike('email', userEmail).maybeSingle();
    const contractorIds = Array.from(new Set([cpRow?.id, userId].filter(Boolean)));
    
    // Query projects with contractor_id IN contractorIds
    const { data: projects, error } = await client.from('projects').select('*').in('contractor_id', contractorIds);
    return { cpId: cpRow?.id, contractorIds, projects: projects || [], error };
  }

  const vRes = await getContractorProjects(vijayaClient, vijayaEmail, vAuth.user.id);
  log('Vijaya Workspace Assigned Projects count', vRes.projects.length);
  if (vRes.projects.length > 0) {
    log('Vijaya Assigned Project Name', vRes.projects[0].name);
    log('Vijaya Assigned Project Details', { building_type: vRes.projects[0].building_type, city: vRes.projects[0].city, contractor_id: vRes.projects[0].contractor_id });
  } else {
    log('ERROR: Vijaya saw 0 assigned projects!', vRes.error?.message);
  }

  // 7. SECURITY TEST FOR HARI (authenticated as hariClient)
  const hRes = await getContractorProjects(hariClient, hariEmail, hAuth.user.id);
  log('Hari Workspace Assigned Projects count (MUST BE 0)', hRes.projects.length);

  // 8. Direct leak check: Hari trying to SELECT Vijaya's project directly by cpVijaya.id
  const { data: leakCheck, error: leakErr } = await hariClient.from('projects').select('*').eq('contractor_id', cpVijaya.id);
  log('Hari direct leak check count (MUST BE 0 under RLS)', leakCheck?.length);

  // Cleanup
  await custClient.from('projects').delete().eq('id', proj.id);
  await vijayaClient.from('contractor_profiles').delete().eq('id', cpVijaya.id);
  await hariClient.from('contractor_profiles').delete().eq('id', cpHari.id);
  log('Cleaned up all test data', 'OK');
}

testSolution2();
