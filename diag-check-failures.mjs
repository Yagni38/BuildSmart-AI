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
const customerEmail = `diag_cust_${ts}@example.com`;
const contractorAEmail = `diag_con_a_${ts}@example.com`;

const custClient = createClient(url, key, { auth: { persistSession: false } });
const { data: custAuth } = await custClient.auth.signUp({
  email: customerEmail,
  password: PASSWORD,
  options: { data: { full_name: 'Customer Diag', role: 'CUSTOMER' } }
});

const conAClient = createClient(url, key, { auth: { persistSession: false } });
const { data: conAAuth } = await conAClient.auth.signUp({
  email: contractorAEmail,
  password: PASSWORD,
  options: { full_name: 'Contractor Diag', role: 'CONTRACTOR' }
});

await new Promise(r => setTimeout(r, 1000));

// Ensure contractor_profile exists
let { data: cpA } = await conAClient.from('contractor_profiles').select('*').eq('id', conAAuth.user.id).maybeSingle();
if (!cpA) {
  await conAClient.from('contractor_profiles').insert({
    id: conAAuth.user.id,
    full_name: 'Contractor Diag',
    email: contractorAEmail,
    verification_status: 'VERIFIED'
  });
  cpA = { id: conAAuth.user.id };
}

// Customer creates project and assigns contractor
const { data: proj } = await custClient.from('projects').insert({
  customer_id: custAuth.user.id,
  name: 'Diag Villa',
  building_type: 'Villa',
  city: 'Bengaluru',
  state: 'Karnataka',
  status: 'PLANNING'
}).select().single();

await custClient.from('projects').update({
  contractor_id: conAAuth.user.id,
  status: 'CONTRACTOR_SELECTED'
}).eq('id', proj.id);

// Test site_logs insert as Contractor A (where contractor_id = conAAuth.user.id)
const { data: photoLog, error: photoErr } = await conAClient.from('site_logs').insert({
  project_id: proj.id,
  contractor_id: conAAuth.user.id,
  description: 'Foundation concrete pour complete',
  image_url: 'https://example.com/site-photo.jpg'
}).select().single();

console.log('site_logs result:', photoLog, photoErr);

// Test messages insert as Customer A
const { data: msgRow, error: msgErr } = await custClient.from('messages').insert({
  project_id: proj.id,
  sender_id: custAuth.user.id,
  receiver_id: conAAuth.user.id,
  message: 'Hello, testing chat message'
}).select().single();

console.log('messages result:', msgRow, msgErr);

// Cleanup
await custClient.from('projects').delete().eq('id', proj.id);
