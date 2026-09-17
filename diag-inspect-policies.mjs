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

// Fetch definition of is_assigned_contractor, is_project_participant, is_project_customer
const { data, error } = await supabase.rpc('pg_policies_info').catch(() => ({ data: null }));

// Let's run a raw query via rpc if available, or query messages policies using anon
console.log('Testing anon messages select...');
const { data: msgs, error: mErr } = await supabase.from('messages').select('*').limit(1);
console.log('Anon messages select:', msgs, mErr);
