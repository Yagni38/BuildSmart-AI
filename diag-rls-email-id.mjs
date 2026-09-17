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

async function testRls() {
  const anon = createClient(url, key);

  // 1. Get vijaya's contractor_profiles row
  const { data: cp } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  log('Vijaya contractor_profiles.id', cp?.id);

  // 2. Sign up / in a customer to create a project assigned to cp.id
  const PASSWORD = 'ProbePassword123!';
  const custEmail = `cust-${Date.now()}@example.com`;
  const custClient = createClient(url, key);
  const { data: cAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Customer', role: 'CUSTOMER' } }
  });
  const custId = cAuth.user.id;

  const { data: proj } = await custClient.from('projects').insert({
    customer_id: custId,
    name: 'Vijaya Project RLS Test',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    status: 'PLANNING',
    contractor_id: cp.id
  }).select().single();

  log('Created Project ID', proj?.id);
  log('Project contractor_id', proj?.contractor_id);

  // 3. Create/Sign in auth user for vijaya@gmail.com
  const vijayaClient = createClient(url, key);
  let vijayaAuthUser = null;
  const { data: vSignIn, error: vErr } = await vijayaClient.auth.signInWithPassword({
    email: 'vijaya@gmail.com',
    password: PASSWORD
  });

  if (vErr) {
    const { data: vSignUp, error: vSignUpErr } = await vijayaClient.auth.signUp({
      email: 'vijaya@gmail.com',
      password: PASSWORD,
      options: { data: { full_name: 'vijaya', role: 'CONTRACTOR' } }
    });
    if (vSignUpErr) {
      log('Sign up error for vijaya@gmail.com', vSignUpErr.message);
    } else {
      vijayaAuthUser = vSignUp.user;
    }
  } else {
    vijayaAuthUser = vSignIn.user;
  }

  log('Vijaya Auth User ID', vijayaAuthUser?.id);

  if (vijayaAuthUser) {
    // Attempt SELECT on projects as Vijaya auth user
    const { data: rows, error: readErr } = await vijayaClient.from('projects').select('*').eq('contractor_id', cp.id);
    log('Vijaya query result by cp.id', { count: rows?.length, error: readErr?.message });

    const { data: rowsAuthId, error: readErrAuth } = await vijayaClient.from('projects').select('*').eq('contractor_id', vijayaAuthUser.id);
    log('Vijaya query result by auth.uid', { count: rowsAuthId?.length, error: readErrAuth?.message });

    const { data: rowsIn, error: readErrIn } = await vijayaClient.from('projects').select('*').in('contractor_id', [cp.id, vijayaAuthUser.id]);
    log('Vijaya query result by IN [cp.id, auth.uid]', { count: rowsIn?.length, error: readErrIn?.message });
  }

  // Cleanup
  await custClient.from('projects').delete().eq('id', proj.id);
  log('Cleanup done', 'OK');
}

testRls();
