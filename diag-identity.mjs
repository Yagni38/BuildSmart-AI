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

console.log('=== CONTRACTOR PROFILES ===');
const { data: cp, error: cpErr } = await supabase.from('contractor_profiles').select('*');
console.log('contractor_profiles count:', cp?.length, cpErr);
console.log(JSON.stringify(cp, null, 2));

console.log('=== PROFILES (CONTRACTOR ROLE) ===');
const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('role', 'CONTRACTOR');
console.log('profiles (CONTRACTOR) count:', prof?.length, profErr);
console.log(JSON.stringify(prof, null, 2));

console.log('=== ALL PROFILES ===');
const { data: allProf } = await supabase.from('profiles').select('*');
console.log('all profiles count:', allProf?.length);
console.log(JSON.stringify(allProf, null, 2));
