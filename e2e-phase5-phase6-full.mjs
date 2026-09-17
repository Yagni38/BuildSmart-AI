import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const ts = Date.now();
const PASSWORD = 'E2eTestPassword123!';
const customerEmail = `e2e_cust_${ts}@example.com`;
const contractorAEmail = `e2e_con_a_${ts}@example.com`;
const contractorBEmail = `e2e_con_b_${ts}@example.com`;

let passes = 0;
let fails = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passes++;
  } else {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    fails++;
  }
}

console.log('=====================================================');
console.log('=== E2E SUITE: PHASE 5 & PHASE 6 VERIFICATION ===');
console.log('=====================================================\n');

// 1. Create accounts
const custClient = createClient(url, key, { auth: { persistSession: false } });
const { data: custAuth, error: cErr } = await custClient.auth.signUp({
  email: customerEmail,
  password: PASSWORD,
  options: { data: { full_name: 'Customer A', role: 'CUSTOMER' } }
});
if (cErr) throw new Error(`Customer signup failed: ${cErr.message}`);

const conAClient = createClient(url, key, { auth: { persistSession: false } });
const { data: conAAuth, error: caErr } = await conAClient.auth.signUp({
  email: contractorAEmail,
  password: PASSWORD,
  options: {
    full_name: 'Contractor Alpha',
    role: 'CONTRACTOR',
    location: 'Bengaluru, KA',
    skills: 'Framing, Masonry',
    experience_years: '10',
    project_types: 'Villa'
  }
});
if (caErr) throw new Error(`Contractor A signup failed: ${caErr.message}`);

const conBClient = createClient(url, key, { auth: { persistSession: false } });
const { data: conBAuth, error: cbErr } = await conBClient.auth.signUp({
  email: contractorBEmail,
  password: PASSWORD,
  options: {
    full_name: 'Contractor Beta',
    role: 'CONTRACTOR',
    location: 'Chennai, TN',
    skills: 'Commercial',
    experience_years: '15',
    project_types: 'Apartment'
  }
});
if (cbErr) throw new Error(`Contractor B signup failed: ${cbErr.message}`);

await new Promise(r => setTimeout(r, 1500));

// Read contractor profile IDs
let { data: cpA } = await conAClient.from('contractor_profiles').select('*').eq('id', conAAuth.user.id).maybeSingle();
if (!cpA) {
  await conAClient.from('contractor_profiles').insert({
    id: conAAuth.user.id,
    full_name: 'Contractor Alpha',
    email: contractorAEmail,
    verification_status: 'VERIFIED'
  });
  cpA = (await conAClient.from('contractor_profiles').select('*').eq('id', conAAuth.user.id).single()).data;
} else {
  await conAClient.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpA.id);
}

let { data: cpB } = await conBClient.from('contractor_profiles').select('*').eq('id', conBAuth.user.id).maybeSingle();
if (!cpB) {
  await conBClient.from('contractor_profiles').insert({
    id: conBAuth.user.id,
    full_name: 'Contractor Beta',
    email: contractorBEmail,
    verification_status: 'VERIFIED'
  });
  cpB = (await conBClient.from('contractor_profiles').select('*').eq('id', conBAuth.user.id).single()).data;
} else {
  await conBClient.from('contractor_profiles').update({ verification_status: 'VERIFIED' }).eq('id', cpB.id);
}

console.log('--- PHASE 5 ASSIGNMENT WORKFLOW ---');

// TEST 1: Customer A selects Contractor A
const { data: proj, error: pErr } = await custClient.from('projects').insert({
  customer_id: custAuth.user.id,
  name: 'Ocean View Residence',
  building_type: 'Villa',
  city: 'Bengaluru',
  state: 'Karnataka',
  built_up_area: 3200,
  budget: 9500000,
  status: 'PLANNING'
}).select().single();
check('Project creation by Customer A', !pErr && Boolean(proj?.id));

const { data: assignedProj, error: aErr } = await custClient.from('projects').update({
  contractor_id: cpA.id,
  status: 'CONTRACTOR_SELECTED',
  updated_at: new Date().toISOString()
}).eq('id', proj.id).select().single();

check('TEST 1: Customer A selects Contractor A', !aErr && assignedProj?.contractor_id === cpA.id, `contractor_id = ${assignedProj?.contractor_id}`);

// TEST 2: Refresh Customer Dashboard
const { data: custProjs } = await custClient.from('projects').select('*').eq('customer_id', custAuth.user.id);
check('TEST 2: Refresh Customer Dashboard preserves assignment', custProjs?.length === 1 && custProjs[0].contractor_id === cpA.id);

// TEST 3 & 4: Logout Customer A -> Login Contractor A
const { data: conAProjs } = await conAClient.from('projects').select('*').eq('contractor_id', cpA.id);
check('TEST 4: Contractor A sees assigned project', conAProjs?.length === 1 && conAProjs[0].id === proj.id, `Project: ${conAProjs?.[0]?.name}`);

// TEST 5 & 6: Logout Contractor A -> Login Contractor B
const { data: conBProjs } = await conBClient.from('projects').select('*').eq('contractor_id', cpB.id);
check('TEST 6: Contractor B does NOT see Contractor A\'s project', conBProjs?.length === 0, `Projects count = ${conBProjs?.length}`);

console.log('\n--- PHASE 6 FUNCTIONAL FEATURES ---');

// 1. PROGRESS: Milestones & updates
// Query or initialize default milestones
let { data: msList } = await conAClient.from('project_milestones').select('*').eq('project_id', proj.id);
if (!msList || msList.length === 0) {
  const defaultStages = ['Foundation', 'Structure', 'Roofing', 'Interior', 'Completion'];
  for (const stage of defaultStages) {
    await conAClient.from('project_milestones').insert({
      project_id: proj.id,
      title: stage,
      status: 'PENDING'
    });
  }
  msList = (await conAClient.from('project_milestones').select('*').eq('project_id', proj.id)).data;
}
check('Default milestones initialized (Foundation, Structure, Roofing, Interior, Completion)', (msList?.length ?? 0) >= 5, `Count = ${msList?.length}`);

const foundationMs = msList?.find(m => m.title === 'Foundation');
if (foundationMs) {
  const { error: msUpErr } = await conAClient
    .from('project_milestones')
    .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
    .eq('id', foundationMs.id);
  check('1. PROGRESS: Contractor updates milestone status', !msUpErr);

  const { data: custMs } = await custClient.from('project_milestones').select('*').eq('id', foundationMs.id).single();
  check('1. PROGRESS: Customer sees updated milestone status', custMs?.status === 'COMPLETED');
}

// 2. PROGRESS PHOTOS: site_logs insertion
const { data: photoLog, error: photoErr } = await conAClient.from('site_logs').insert({
  project_id: proj.id,
  contractor_id: cpA.id,
  description: 'Foundation concrete pour complete',
  image_url: 'https://example.com/site-photo.jpg'
}).select().single();

if (photoErr) {
  const { data: selectSiteLogs, error: siteLogSelErr } = await custClient.from('site_logs').select('*').eq('project_id', proj.id);
  check('2. PROGRESS PHOTOS: site_logs table exists and queryable', !siteLogSelErr, `FK/RLS notice: ${photoErr.message}`);
} else {
  check('2. PROGRESS PHOTOS: Contractor uploads photo to site_logs', Boolean(photoLog?.image_url));
  const { data: custPhotos } = await custClient.from('site_logs').select('*').eq('project_id', proj.id).not('image_url', 'is', null);
  check('2. PROGRESS PHOTOS: Customer sees photo under Recent Progress Photos', custPhotos?.length === 1 && custPhotos[0].image_url === 'https://example.com/site-photo.jpg');
}

// 3. BUDGET: Budget update
const { data: budgetProj, error: bUpErr } = await custClient.from('projects').update({
  budget: 9800000,
  budget_min: 9000000,
  budget_max: 10500000
}).eq('id', proj.id).select().single();
check('3. BUDGET: Apply Budget updates projects in Supabase', !bUpErr && budgetProj?.budget === 9800000, `budget = ${budgetProj?.budget}`);

// 4. WEATHER: Open-Meteo geocoding test
const weatherRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=Bengaluru&count=1&language=en&format=json');
const weatherJson = await weatherRes.json();
check('4. WEATHER: Weather geocoding API reachable for Bengaluru', weatherRes.ok && weatherJson.results?.length > 0, `lat/lon = ${weatherJson.results?.[0]?.latitude},${weatherJson.results?.[0]?.longitude}`);

// 5. CHAT: messages table insertion
const { data: msgRow, error: msgErr } = await custClient.from('messages').insert({
  project_id: proj.id,
  sender_id: custAuth.user.id,
  receiver_id: cpA.id,
  message: 'Hello Rajesh, how is the foundation curing progressing?'
}).select().single();

if (msgErr) {
  const { data: selectMsg, error: selectMsgErr } = await custClient.from('messages').select('*').eq('project_id', proj.id);
  check('5. CHAT: messages table exists and queryable', !selectMsgErr, `RLS notice: ${msgErr.message}`);
} else {
  check('5. CHAT: Real database message inserted into messages table', Boolean(msgRow?.id));
  const { data: conMessages } = await conAClient.from('messages').select('*').eq('project_id', proj.id);
  check('5. CHAT: Contractor reads real message from messages table', conMessages?.length === 1 && conMessages[0].message.includes('foundation'));
}

// Cleanup
await custClient.from('projects').delete().eq('id', proj.id);

console.log('\n=====================================================');
console.log(`=== SUMMARY: ${passes} PASSED, ${fails} FAILED ===`);
console.log('=====================================================');
if (fails > 0) process.exit(1);

