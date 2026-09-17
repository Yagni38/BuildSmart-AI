import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const PASSWORD = 'E2eTestPassword123!';
const ts = Date.now();
const custEmail = `cust_sitelog_${ts}@example.com`;
const conEmail = `con_sitelog_${ts}@example.com`;

const custClient = createClient(url, key, { auth: { persistSession: false } });
const { data: custAuth } = await custClient.auth.signUp({ email: custEmail, password: PASSWORD, options: { data: { role: 'CUSTOMER' } } });

const conClient = createClient(url, key, { auth: { persistSession: false } });
const { data: conAuth } = await conClient.auth.signUp({ email: conEmail, password: PASSWORD, options: { data: { role: 'CONTRACTOR' } } });

await new Promise(r => setTimeout(r, 1000));

// Create contractor profile
const { data: cpCheck } = await conClient.from('contractor_profiles').select('*').eq('id', conAuth.user.id).maybeSingle();
if (!cpCheck) {
  await conClient.from('contractor_profiles').insert({ id: conAuth.user.id, full_name: 'Test Contractor', email: conEmail, verification_status: 'VERIFIED' });
}

// Customer creates project and assigns contractor
const { data: proj } = await custClient.from('projects').insert({
  customer_id: custAuth.user.id,
  name: 'SiteLog Test Project',
  city: 'Bengaluru',
  state: 'Karnataka',
  status: 'PLANNING'
}).select().single();

await custClient.from('projects').update({ contractor_id: conAuth.user.id, status: 'CONTRACTOR_SELECTED' }).eq('id', proj.id);

// Contractor inserts site_log with contractor_id = null
const { data: slNull, error: slNullErr } = await conClient.from('site_logs').insert({
  project_id: proj.id,
  contractor_id: null,
  description: 'Foundation photo test',
  image_url: 'https://example.com/photo.jpg'
}).select().single();

console.log('site_logs with contractor_id = null:', slNull, slNullErr);

// Customer reads site_logs
const { data: custReadLogs, error: custReadErr } = await custClient.from('site_logs').select('*').eq('project_id', proj.id);
console.log('Customer read site_logs:', custReadLogs, custReadErr);

// Cleanup
await custClient.from('projects').delete().eq('id', proj.id);
