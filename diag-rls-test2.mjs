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

async function testRls2() {
  const PASSWORD = 'ProbePassword123!';
  const stamp = Date.now();
  const custEmail = `customer-test-${stamp}@example.com`;

  const anon = createClient(url, key);

  // 1. Get existing verified contractor profile for vijaya@gmail.com
  const { data: cp } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  log('Found contractor_profile', { id: cp?.id, email: cp?.email });

  // 2. Sign in or sign up contractor in auth.users
  const conClient = createClient(url, key);
  let conAuthUser = null;
  const { data: cSignIn, error: cErr } = await conClient.auth.signInWithPassword({
    email: 'vijaya@gmail.com',
    password: PASSWORD
  });
  if (cErr) {
    log('Sign in failed for vijaya@gmail.com:', cErr.message);
  } else {
    conAuthUser = cSignIn.user;
  }
  log('Contractor Auth User ID', conAuthUser?.id);
  log('Does cp.id equal conAuthUser.id?', cp?.id === conAuthUser?.id);

  // 3. Customer creates project assigned to cp.id
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Customer', role: 'CUSTOMER' } }
  });

  const { data: proj, error: pErr } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'RLS Check Project',
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    status: 'PLANNING',
    contractor_id: cp.id
  }).select().single();
  log('Created Project assigned to cp.id', { projId: proj?.id, contractor_id: proj?.contractor_id, err: pErr?.message });

  // 4. Query project as contractor authenticated user (if signed in) or as customer
  if (conAuthUser) {
    const { data: conSelectCpId, error: err1 } = await conClient.from('projects').select('*').eq('contractor_id', cp.id);
    log('Contractor query by cp.id under RLS', { count: conSelectCpId?.length, err: err1?.message });

    const { data: conSelectAuthId, error: err2 } = await conClient.from('projects').select('*').eq('contractor_id', conAuthUser.id);
    log('Contractor query by auth.uid under RLS', { count: conSelectAuthId?.length, err: err2?.message });
  } else {
    log('Note', 'Vijaya is not signed in so cannot test RLS query as Vijaya yet.');
  }

  // Cleanup
  if (proj?.id) await custClient.from('projects').delete().eq('id', proj.id);
  log('Done', 'OK');
}

testRls2();
