import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const supabase = createClient(url, key);

// Test inserting site_logs with contractor_id: null
const { data: testProj } = await supabase.from('projects').select('id, contractor_id').limit(1).single();

console.log('Testing site_logs insert with contractor_id = null...');
const { data: slNull, error: slNullErr } = await supabase.from('site_logs').insert({
  project_id: testProj.id,
  contractor_id: null,
  description: 'Test null contractor_id',
  image_url: 'https://example.com/test.jpg'
}).select().single();
console.log('site_logs (null contractor_id) result:', slNull, slNullErr);

// Test site_logs insert with contractor_id = testProj.contractor_id
if (testProj.contractor_id) {
  console.log('Testing site_logs insert with contractor_id = testProj.contractor_id...');
  const { data: slCp, error: slCpErr } = await supabase.from('site_logs').insert({
    project_id: testProj.id,
    contractor_id: testProj.contractor_id,
    description: 'Test cp contractor_id',
    image_url: 'https://example.com/test.jpg'
  }).select().single();
  console.log('site_logs (cp contractor_id) result:', slCp, slCpErr);
}
