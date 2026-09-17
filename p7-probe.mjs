import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const sb = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY'));

const cols = [
  'id', 'project_id', 'contractor_id', 'customer_id', 'name', 'title',
  'milestone_name', 'description', 'status', 'due_date', 'expected_end_date',
  'start_date', 'completed_date', 'completed_at', 'progress', 'updated_at',
  'created_at', 'comments', 'completion_percent',
];

console.log('project_milestones columns probe:');
for (const c of cols) {
  const r = await sb.from('project_milestones').select(c).limit(0);
  console.log(`  ${c}: ${r.error ? `MISSING (${r.error.code})` : 'OK'}`);
}

const p = await sb.from('projects').select('progress').limit(0);
console.log('projects.progress:', p.error ? `MISSING (${p.error.code})` : 'OK');