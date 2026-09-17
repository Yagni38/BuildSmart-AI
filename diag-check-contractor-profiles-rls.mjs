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

// Let's check what contractor_profiles rows exist
const { data: cpRows } = await supabase.from('contractor_profiles').select('id, full_name, email, verification_status');
console.log('Public/Anon contractor_profiles rows:', cpRows);
