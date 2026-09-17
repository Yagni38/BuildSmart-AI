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

async function testRls3() {
  const PASSWORD = 'ProbePassword123!';
  const stamp = Date.now();
  const conEmail = `contractor-rls-${stamp}@example.com`;
  const custEmail = `customer-rls-${stamp}@example.com`;

  const anon = createClient(url, key);

  // 1. Sign up a new contractor via Auth
  const conClient = createClient(url, key);
  const { data: cAuth, error: cAuthErr } = await conClient.auth.signUp({
    email: conEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Contractor RLS', role: 'CONTRACTOR' } }
  });

  if (cAuthErr) {
    log('Contractor signup failed', cAuthErr.message);
    return;
  }
  const conAuthId = cAuth.user.id;
  log('Contractor Auth User ID', conAuthId);

  // 2. Fetch or check contractor_profiles
  const { data: cp } = await anon.from('contractor_profiles').select('*').ilike('email', conEmail).maybeSingle();
  log('contractor_profiles for conEmail', cp);

  // 3. Customer creates a project assigned to a custom UUID (simulating a contractor_profiles.id that != conAuthId)
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Customer RLS', role: 'CUSTOMER' } }
  });

  const customCpId = '977eeb06-650f-44b4-bea7-d2768ab6fb10'; // e.g. Hari's contractor_profiles.id or vijaya's
  const { data: proj1 } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Project with conAuthId',
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    status: 'PLANNING',
    contractor_id: conAuthId
  }).select().single();

  const { data: proj2 } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Project with customCpId',
    building_type: 'Villa',
    city: 'Bengaluru',
    state: 'Karnataka',
    status: 'PLANNING',
    contractor_id: customCpId
  }).select().single();

  log('proj1 (contractor_id = conAuthId)', proj1?.id);
  log('proj2 (contractor_id = customCpId)', proj2?.id);

  // 4. Contractor user queries projects under RLS
  const { data: rowsAuthId, error: err1 } = await conClient.from('projects').select('*').eq('contractor_id', conAuthId);
  log('Contractor query for proj1 (eq conAuthId)', { count: rowsAuthId?.length, err: err1?.message });

  const { data: rowsCustomCpId, error: err2 } = await conClient.from('projects').select('*').eq('contractor_id', customCpId);
  log('Contractor query for proj2 (eq customCpId)', { count: rowsCustomCpId?.length, err: err2?.message });

  // Cleanup
  if (proj1?.id) await custClient.from('projects').delete().eq('id', proj1.id);
  if (proj2?.id) await custClient.from('projects').delete().eq('id', proj2.id);
  log('Done', 'OK');
}

testRls3();
