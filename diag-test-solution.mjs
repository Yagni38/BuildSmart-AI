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

async function testSolution() {
  const anon = createClient(url, key);

  // 1. Get vijaya contractor profile
  const { data: cpVijaya } = await anon.from('contractor_profiles').select('*').ilike('email', 'vijaya@gmail.com').single();
  log('Vijaya contractor_profiles record', { id: cpVijaya.id, name: cpVijaya.full_name, email: cpVijaya.email });

  // 2. Get hari contractor profile
  const { data: cpHari } = await anon.from('contractor_profiles').select('*').ilike('email', 'hari138@gmail.com').single();
  log('Hari contractor_profiles record', { id: cpHari.id, name: cpHari.full_name, email: cpHari.email });

  // 3. Create customer + project assigned to Vijaya's cp.id
  const PASSWORD = 'TestPassword123!';
  const custEmail = `cust-sol-${Date.now()}@example.com`;
  const custClient = createClient(url, key);
  const { data: custAuth } = await custClient.auth.signUp({
    email: custEmail,
    password: PASSWORD,
    options: { data: { full_name: 'Solution Customer', role: 'CUSTOMER' } }
  });

  const { data: proj, error: pErr } = await custClient.from('projects').insert({
    customer_id: custAuth.user.id,
    name: 'Smart Villa Construction Project',
    building_type: 'Villa',
    city: 'Narasaraopet',
    state: 'Andhra Pradesh',
    built_up_area: 2400,
    floors: 2,
    bedrooms: 3,
    bathrooms: 3,
    budget: 6500000,
    contractor_id: cpVijaya.id,
    status: 'CONTRACTOR_SELECTED'
  }).select().single();

  log('Customer created & assigned project', { id: proj?.id, contractor_id: proj?.contractor_id, name: proj?.name, err: pErr?.message });

  // 4. Test contractor resolution logic as if logged in as Vijaya
  // Function to resolve contractor identity & fetch assigned projects
  async function fetchContractorWorkspaceProjects(userEmail, userId, client) {
    // Step A: lookup contractor_profiles by authenticated email
    const { data: cpRow } = await client.from('contractor_profiles').select('id').ilike('email', userEmail).maybeSingle();
    const idsToQuery = Array.from(new Set([cpRow?.id, userId].filter(Boolean)));
    
    // Step B: query projects where contractor_id IN (idsToQuery)
    const { data: projects, error } = await client.from('projects').select('*').in('contractor_id', idsToQuery);
    return { cpId: cpRow?.id, idsToQuery, projects: projects || [], error };
  }

  // Simulate Customer client reading back project
  const { data: custReadProj } = await custClient.from('projects').select('*, contractor_id').eq('id', proj.id).single();
  log('Customer Dashboard restored project contractor_id', custReadProj?.contractor_id);
  const { data: assignedContractorCp } = await custClient.from('contractor_profiles').select('*').eq('id', custReadProj.contractor_id).single();
  log('Customer Dashboard restored contractor name', assignedContractorCp?.full_name);

  // Simulate Vijaya logged in:
  const vijayaResult = await fetchContractorWorkspaceProjects('vijaya@gmail.com', 'dummy-vijaya-auth-id', custClient);
  log('Vijaya Workspace Assigned Projects count', vijayaResult.projects.length);
  if (vijayaResult.projects.length > 0) {
    log('Vijaya Workspace Project Name', vijayaResult.projects[0].name);
    log('Vijaya Workspace Project City', vijayaResult.projects[0].city);
  }

  // Simulate Hari logged in:
  const hariResult = await fetchContractorWorkspaceProjects('hari138@gmail.com', 'dummy-hari-auth-id', custClient);
  log('Hari Workspace Assigned Projects count (MUST BE 0)', hariResult.projects.length);

  // Cleanup
  await custClient.from('projects').delete().eq('id', proj.id);
  log('Cleaned up project', 'OK');
}

testSolution();
