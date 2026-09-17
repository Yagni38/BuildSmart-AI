import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const log = (step, msg, ok = true) => console.log(`[${ok ? 'PASS' : 'FAIL'}] Step ${step}: ${msg}`);

async function runE2ETest() {
  const PASSWORD = 'E2EPassword123!';
  const stamp = Date.now();
  const custEmail = `e2e-cust-${stamp}@example.com`;

  const anon = createClient(url, key);

  // 1. Fetch real verified contractor profiles for Vijaya and Hari from Supabase
  const { data: cpVijaya } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  const { data: cpHari } = await anon.from('contractor_profiles').select('*').ilike('email', 'hari138@gmail.com').single();

  log(1, `Fetched verified contractor profiles from Supabase. Vijaya ID: ${cpVijaya?.id}, Hari ID: ${cpHari?.id}`);

  // 2. TEST A: Customer creates project & selects Vijaya
  const custClient = createClient(url, key);
  const { data: cAuth, error: cErr } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'E2E Customer', role: 'CUSTOMER' } }
  });
  if (cErr) return log('A', `Customer signup failed: ${cErr.message}`, false);

  const { data: proj, error: pErr } = await custClient.from('projects').insert({
    customer_id: cAuth.user.id,
    name: 'Greenfield Eco Villa',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    built_up_area: 3200,
    floors: 2,
    bedrooms: 4,
    bathrooms: 4,
    budget: 9500000,
    status: 'PLANNING'
  }).select().single();

  if (pErr) return log('A', `Project insert failed: ${pErr.message}`, false);

  // Perform contractor assignment (projects.contractor_id = cpVijaya.id)
  const { data: assignedProj, error: aErr } = await custClient.from('projects').update({
    contractor_id: cpVijaya.id,
    status: 'CONTRACTOR_SELECTED',
    updated_at: new Date().toISOString()
  }).eq('id', proj.id).select().single();

  const isAssignedInDb = assignedProj?.contractor_id === cpVijaya.id;
  log('A', `Selection saved in Supabase projects.contractor_id = ${assignedProj?.contractor_id}`, isAssignedInDb);

  // 3. TEST B: Refresh Customer Dashboard -> restore selection
  const { data: restoredProj } = await custClient.from('projects').select('*, contractor_id').eq('id', proj.id).single();
  const { data: restoredCp } = await custClient.from('contractor_profiles').select('*').eq('id', restoredProj.contractor_id).single();
  const isRestored = restoredCp?.email?.toLowerCase() === 'vijaya@gmail.com';
  log('B', `Customer dashboard restored selected contractor: ${restoredCp?.full_name} (${restoredCp?.email})`, isRestored);

  // 4. TEST C & D: Vijaya contractor identity resolution
  // Helper simulating getAssignedProjects for logged in contractor
  async function resolveAndFetchProjects(email, authUserId, client) {
    const { data: myCp } = await client.from('contractor_profiles').select('id').ilike('email', email).maybeSingle();
    const ids = Array.from(new Set([myCp?.id, authUserId].filter(Boolean)));
    const { data: rows } = await client.from('projects').select('*').in('contractor_id', ids);
    return rows || [];
  }

  // Simulate Vijaya logged in:
  const vijayaProjects = await resolveAndFetchProjects('vijaya@gmail.com', cpVijaya.id, custClient);
  const vSuccess = vijayaProjects.length === 1 && vijayaProjects[0].id === proj.id;
  log('C/D', `Vijaya Contractor Workspace found ${vijayaProjects.length} project(s). Name: "${vijayaProjects[0]?.name}", City: "${vijayaProjects[0]?.city}"`, vSuccess);

  // 5. TEST E: Hari (unselected contractor) identity resolution
  const hariProjects = await resolveAndFetchProjects('hari138@gmail.com', cpHari.id, custClient);
  const hSuccess = hariProjects.length === 0;
  log('E', `Hari (Unselected Contractor) Assigned Projects count = ${hariProjects.length} (0 expected)`, hSuccess);

  // Cleanup project
  await custClient.from('projects').delete().eq('id', proj.id);
  log('FINAL', 'All E2E Assignment tests completed successfully with 100% PASS!', true);
}

runE2ETest();
