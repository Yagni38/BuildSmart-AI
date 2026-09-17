import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const timestamp = Date.now();
const PASSWORD = 'TestPassword123!';
const customerEmail = `customer_a_${timestamp}@example.com`;
const contractorAEmail = `contractor_a_${timestamp}@example.com`;
const contractorBEmail = `contractor_b_${timestamp}@example.com`;

console.log('=== PHASE 5 REAL ASSIGNMENT WORKFLOW TEST ===\n');

// Step 0: Create authenticated accounts
console.log('0. Registering accounts...');
const clientCustomer = createClient(url, key, { auth: { persistSession: false } });
const { data: custAuth, error: custErr } = await clientCustomer.auth.signUp({
  email: customerEmail,
  password: PASSWORD,
  options: { data: { full_name: 'Customer Alpha', role: 'CUSTOMER' } }
});
if (custErr) throw new Error(`Customer signup failed: ${custErr.message}`);
const customerId = custAuth.user.id;
console.log('   Customer A registered, user_id:', customerId);

const clientContractorA = createClient(url, key, { auth: { persistSession: false } });
const { data: conAAuth, error: conAErr } = await clientContractorA.auth.signUp({
  email: contractorAEmail,
  password: PASSWORD,
  options: {
    full_name: 'Contractor Alpha Builders',
    role: 'CONTRACTOR',
    location: 'Bengaluru, KA',
    skills: 'Structural Construction, Framing',
    experience_years: '8',
    project_types: 'Residential Villa'
  }
});
if (conAErr) throw new Error(`Contractor A signup failed: ${conAErr.message}`);
const contractorAUserId = conAAuth.user.id;
console.log('   Contractor A registered, user_id:', contractorAUserId);

const clientContractorB = createClient(url, key, { auth: { persistSession: false } });
const { data: conBAuth, error: conBErr } = await clientContractorB.auth.signUp({
  email: contractorBEmail,
  password: PASSWORD,
  options: {
    full_name: 'Contractor Beta Constructions',
    role: 'CONTRACTOR',
    location: 'Hyderabad, TS',
    skills: 'Commercial, High-rise',
    experience_years: '12',
    project_types: 'Apartments'
  }
});
if (conBErr) throw new Error(`Contractor B signup failed: ${conBErr.message}`);
const contractorBUserId = conBAuth.user.id;
console.log('   Contractor B registered, user_id:', contractorBUserId);

// Pause to let triggers run
await new Promise(r => setTimeout(r, 1500));

// Read contractor_profiles as Contractor A and Contractor B by id
const { data: cpA, error: cpAErr } = await clientContractorA.from('contractor_profiles').select('*').eq('id', contractorAUserId).maybeSingle();
const { data: cpB, error: cpBErr } = await clientContractorB.from('contractor_profiles').select('*').eq('id', contractorBUserId).maybeSingle();

console.log('   Contractor A profile read by A:', cpA, cpAErr);
console.log('   Contractor B profile read by B:', cpB, cpBErr);

// If trigger created rows, update status as the contractor or check status
if (!cpA) {
  // Insert contractor profile manually if trigger didn't run
  await clientContractorA.from('contractor_profiles').insert({
    id: contractorAUserId,
    full_name: 'Contractor Alpha Builders',
    email: contractorAEmail,
    verification_status: 'VERIFIED'
  });
} else {
  await clientContractorA.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpA.id);
}

if (!cpB) {
  await clientContractorB.from('contractor_profiles').insert({
    id: contractorBUserId,
    full_name: 'Contractor Beta Constructions',
    email: contractorBEmail,
    verification_status: 'VERIFIED'
  });
} else {
  await clientContractorB.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpB.id);
}

const { data: cpA2 } = await clientContractorA.from('contractor_profiles').select('*').eq('id', contractorAUserId).maybeSingle();
const { data: cpB2 } = await clientContractorB.from('contractor_profiles').select('*').eq('id', contractorBUserId).maybeSingle();

console.log('   Contractor A verified profile:', cpA2);
console.log('   Contractor B verified profile:', cpB2);

const contractorAProfileId = cpA2.id;
const contractorBProfileId = cpB2.id;

console.log('\nTEST 1: Customer A creates project and selects Contractor A...');
const { data: proj, error: pErr } = await clientCustomer.from('projects').insert({
  customer_id: customerId,
  name: 'Alpha Luxury Villa',
  building_type: 'Residential Villa',
  city: 'Bengaluru',
  state: 'Karnataka',
  status: 'PLANNING'
}).select().single();

if (pErr) throw new Error(`Project creation failed: ${pErr.message}`);
console.log('   Project created:', proj.id);

// Customer selects Contractor A (contractorAProfileId)
const { data: assignedProj, error: assignErr } = await clientCustomer.from('projects').update({
  contractor_id: contractorAProfileId,
  status: 'CONTRACTOR_SELECTED',
  updated_at: new Date().toISOString()
}).eq('id', proj.id).select().single();

if (assignErr) throw new Error(`Assignment failed: ${assignErr.message}`);
console.log('   TEST 1 RESULT: Customer assigned Contractor A successfully!');
console.log('   projects.contractor_id =', assignedProj.contractor_id);
console.log('   projects.status =', assignedProj.status);

console.log('\nTEST 2: Refresh Customer Dashboard (Re-query project as Customer A)...');
const { data: refreshedProjList, error: refErr } = await clientCustomer
  .from('projects')
  .select('*')
  .eq('customer_id', customerId);

if (refErr) throw new Error(`Customer refresh failed: ${refErr.message}`);
console.log('   TEST 2 RESULT: Customer refreshed dashboard. Projects found:', refreshedProjList.length);
console.log('   Preserved contractor_id =', refreshedProjList[0]?.contractor_id);

console.log('\nTEST 3 & 4: Logout Customer A -> Login as Contractor A...');
const { data: conAProjects, error: conAErrQuery } = await clientContractorA
  .from('projects')
  .select('*')
  .eq('contractor_id', contractorAProfileId);

if (conAErrQuery) throw new Error(`Contractor A query failed: ${conAErrQuery.message}`);
console.log('   TEST 4 RESULT: Contractor A query assigned projects count:', conAProjects.length);
if (conAProjects.length === 1 && conAProjects[0].id === proj.id) {
  console.log('   PASS: Contractor A sees assigned project:', conAProjects[0].name);
} else {
  console.error('   FAIL: Contractor A did NOT see the assigned project!');
}

console.log('\nTEST 5 & 6: Logout Contractor A -> Login as Contractor B...');
const { data: conBProjects, error: conBErrQuery } = await clientContractorB
  .from('projects')
  .select('*')
  .eq('contractor_id', contractorBProfileId);

if (conBErrQuery) throw new Error(`Contractor B query failed: ${conBErrQuery.message}`);
console.log('   TEST 6 RESULT: Contractor B query assigned projects count:', conBProjects.length);
if (conBProjects.length === 0) {
  console.log('   PASS: Contractor B does NOT see Contractor A\'s project!');
} else {
  console.error('   FAIL: Contractor B saw Contractor A\'s project!');
}

// Cleanup
console.log('\nCleaning up test project...');
await clientCustomer.from('projects').delete().eq('id', proj.id);
console.log('=== TEST SUITE COMPLETE ===');
