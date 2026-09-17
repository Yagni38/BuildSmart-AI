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

async function verifyResolution() {
  const anon = createClient(url, key);

  // 1. Customer signs up & creates project assigned to Vijaya's contractor_profiles.id
  const PASSWORD = 'ProbePassword123!';
  const custEmail = `cust-vr-${Date.now()}@example.com`;
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Test Customer VR', role: 'CUSTOMER' } }
  });

  const { data: vijayaCp } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  log('Vijaya contractor_profiles.id', vijayaCp.id);

  const { data: proj } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Luxury Villa for Vijaya Test',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    status: 'PLANNING',
    contractor_id: vijayaCp.id
  }).select().single();

  log('Customer assigned project to Vijaya cp.id', { projId: proj.id, contractor_id: proj.contractor_id });

  // 2. Now simulate a new contractor registering via contractor registration flow
  const conEmail = `contractor-vr-${Date.now()}@example.com`;
  const conClient = createClient(url, key);
  const { data: conAuth } = await conClient.auth.signUp({
    email: conEmail,
    password: PASSWORD,
    options: { data: { full_name: 'New Contractor VR', role: 'CONTRACTOR' } }
  });
  log('New Contractor Auth User ID', conAuth.user.id);

  // Contractor registers profile: contractor_profiles insert
  const { data: conCp, error: cpInsErr } = await conClient.from('contractor_profiles').insert({
    full_name: 'New Contractor VR',
    email: conEmail,
    verification_status: 'VERIFIED'
  }).select().single();
  log('New Contractor contractor_profiles.id', { id: conCp?.id, err: cpInsErr?.message });

  if (conCp) {
    // Assign a project to new contractor's conCp.id
    const { data: proj2 } = await custClient.from('projects').insert({
      customer_id: custAuth.user.id,
      name: 'New Contractor Project',
      building_type: 'House',
      city: 'Bengaluru',
      state: 'Karnataka',
      status: 'PLANNING',
      contractor_id: conCp.id
    }).select().single();

    // NOW TEST RESOLVED CONTRACTOR QUERY:
    // Step A: Logged in contractor `conClient` resolves contractor_profiles by email
    const { data: myCp } = await conClient.from('contractor_profiles').select('id').ilike('email', conEmail).maybeSingle();
    log('Resolved myCp.id from conClient authenticated session', myCp?.id);

    const idsToQuery = Array.from(new Set([myCp?.id, conAuth.user.id].filter(Boolean)));
    log('IDs to query in projects', idsToQuery);

    const { data: myAssignedProjects, error: myErr } = await conClient.from('projects').select('*').in('contractor_id', idsToQuery);
    log('Assigned projects returned for New Contractor', { count: myAssignedProjects?.length, projName: myAssignedProjects?.[0]?.name, err: myErr?.message });

    // SECURITY CHECK: can new contractor see Vijaya's project?
    const { data: leakedProjects } = await conClient.from('projects').select('*').eq('contractor_id', vijayaCp.id);
    log('Leaked projects count (MUST BE 0)', leakedProjects?.length);

    await custClient.from('projects').delete().eq('id', proj2.id);
    await conClient.from('contractor_profiles').delete().eq('id', conCp.id);
  }

  // Cleanup
  await custClient.from('projects').delete().eq('id', proj.id);
  log('Cleanup complete', 'OK');
}

verifyResolution();
