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

async function runTest() {
  const anon = createClient(url, key);

  // 1. Fetch contractor profiles
  const { data: cpList, error: cpErr } = await anon.from('contractor_profiles').select('*').eq('verification_status', 'VERIFIED');
  log('Verified contractor profiles count', cpList?.length);
  if (!cpList || cpList.length === 0) {
    log('No verified contractor profiles found!', cpErr);
    return;
  }

  const targetContractor = cpList.find(c => c.email.toLowerCase() === 'vijaya@gmail.com') || cpList[0];
  log('Target Contractor Profile', { id: targetContractor.id, name: targetContractor.full_name, email: targetContractor.email });

  const otherContractor = cpList.find(c => c.id !== targetContractor.id) || cpList[1];
  log('Other Contractor Profile', otherContractor ? { id: otherContractor.id, name: otherContractor.full_name, email: otherContractor.email } : 'None');

  // 2. Sign up / in test customer
  const PASSWORD = 'TestPassword123!';
  const custEmail = `test-cust-${Date.now()}@example.com`;
  const custClient = createClient(url, key);
  const { data: custAuth, error: custAuthErr } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Customer', role: 'CUSTOMER' } }
  });
  if (custAuthErr) {
    log('Customer signup failed', custAuthErr.message);
    return;
  }
  log('Customer User ID', custAuth.user?.id);

  // 3. Create project as Customer
  const { data: proj, error: projErr } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Villa Build Test Project',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    status: 'PLANNING'
  }).select().single();

  if (projErr) {
    log('Project creation failed', projErr.message);
    return;
  }
  log('Created Project ID', proj.id);

  // 4. Assign contractor to project
  const { data: assignedProj, error: assignErr } = await custClient.from('projects').update({
    contractor_id: targetContractor.id,
    status: 'CONTRACTOR_SELECTED',
    updated_at: new Date().toISOString()
  }).eq('id', proj.id).select().single();

  if (assignErr) {
    log('Assignment update failed', assignErr.message);
  } else {
    log('Assigned Project contractor_id', assignedProj.contractor_id);
    log('Assignment persisted correctly?', assignedProj.contractor_id === targetContractor.id);
  }

  // 5. Sign up / in as target contractor
  const targetClient = createClient(url, key);
  let targetAuthUser = null;
  const { data: tSignIn, error: tSignInErr } = await targetClient.auth.signInWithPassword({
    email: targetContractor.email,
    password: PASSWORD
  });
  if (tSignInErr) {
    log('Target contractor signin failed (trying signup)', tSignInErr.message);
    const { data: tSignUp, error: tSignUpErr } = await targetClient.auth.signUp({
      email: targetContractor.email,
      password: PASSWORD,
      options: { data: { full_name: targetContractor.full_name, role: 'CONTRACTOR' } }
    });
    if (tSignUpErr) {
      log('Target contractor signup failed', tSignUpErr.message);
    } else {
      targetAuthUser = tSignUp.user;
    }
  } else {
    targetAuthUser = tSignIn.user;
  }
  log('Target Contractor Auth User ID', targetAuthUser?.id);

  if (targetAuthUser) {
    // 6. Test contractor project query logic
    // Resolve contractor profile id from authenticated email
    const { data: resolvedCp } = await targetClient.from('contractor_profiles').select('id').ilike('email', targetContractor.email).maybeSingle();
    log('Resolved contractor_profiles.id from Auth User email', resolvedCp?.id);

    const contractorIdsToQuery = Array.from(new Set([targetAuthUser.id, resolvedCp?.id].filter(Boolean)));
    log('Contractor IDs to query', contractorIdsToQuery);

    // Query projects with targetClient (authenticated as target contractor)
    const { data: assignedProjects, error: apErr } = await targetClient.from('projects').select('*').in('contractor_id', contractorIdsToQuery);
    log('Assigned Projects found for target contractor under RLS', { count: assignedProjects?.length, error: apErr?.message });
    if (assignedProjects && assignedProjects.length > 0) {
      log('Assigned Project Name', assignedProjects[0].name);
    }
  }

  // 7. Cleanup project
  await custClient.from('projects').delete().eq('id', proj.id);
  log('Cleanup done', 'OK');
}

runTest();
