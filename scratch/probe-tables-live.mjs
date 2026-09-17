import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const supabase = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });

const TABLES = [
  'profiles', 'contractor_profiles', 'projects', 'project_milestones', 'site_logs',
  'contractor_documents', 'contractor_matches', 'quotes', 'messages',
  'expenses', 'expense_records', 'project_expenses', 'notifications',
  'project_updates', 'construction_photos', 'contractors', 'milestones',
];
for (const t of TABLES) {
  const { error } = await supabase.from(t).select('id').limit(0);
  if (!error) { console.log(`OK        ${t}`); continue; }
  console.log(`MISSING?? ${t}  code=${error.code} msg=${error.message}`);
}

console.log('\n--- messages columns ---');
for (const c of ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'created_at']) {
  const { error } = await supabase.from('messages').select(c).limit(0);
  console.log(`  ${c}: ${error ? 'MISSING ' + error.code : 'exists'}`);
}