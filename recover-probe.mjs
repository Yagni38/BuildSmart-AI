// READ-ONLY schema probe (no writes, no deletes, no config changes).
// Discovers the REAL live columns for the tables the app depends on.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const supabase = createClient(
  get('VITE_SUPABASE_URL'),
  get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY')
);

async function probeColumns(table, candidates) {
  let remaining = [...candidates];
  const found = [];
  for (let i = 0; i < candidates.length * 2; i++) {
    if (remaining.length === 0) break;
    const { error } = await supabase.from(table).select(remaining.join(',')).limit(1);
    if (!error) {
      found.push(...remaining);
      break;
    }
    const quoted = [...error.message.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const bare = error.message.match(/column\s+(?:[a-zA-Z_]+\.)?([a-zA-Z_]+)\s+does not exist/);
    const reported = bare ? [...quoted, bare[1]] : quoted;
    const missing = reported.filter((q) => remaining.includes(q));
    if (missing.length === 0) {
      console.log(`${table}: UNEXPECTED error ${error.code} — ${error.message}`);
      return found;
    }
    remaining = remaining.filter((c) => !missing.includes(c));
  }
  return found;
}

for (const [table, cols] of Object.entries({
  contractor_profiles: [
    'id', 'user_id', 'profile_id', 'full_name', 'email', 'phone', 'location',
    'skills', 'experience_years', 'project_types', 'company_name', 'description',
    'resume_path', 'resume_url', 'verification_status', 'rejection_reason',
    'created_at', 'updated_at',
  ],
  profiles: [
    'id', 'full_name', 'email', 'phone', 'role', 'city', 'state', 'avatar_url',
    'location', 'skills', 'years_of_experience', 'project_types', 'company_name',
    'description', 'resume_path', 'resume_url', 'verification_status',
    'rejection_reason', 'created_at', 'updated_at',
  ],
  projects: [
    'id', 'customer_id', 'contractor_id', 'name', 'building_type', 'description',
    'city', 'state', 'plot_length', 'plot_width', 'plot_size', 'built_up_area',
    'floors', 'bedrooms', 'bathrooms', 'soil_type', 'budget', 'budget_min',
    'budget_max', 'expected_completion', 'timeline', 'priority', 'design_style',
    'parking', 'kitchen_type', 'material_preference', 'sustainability_preference',
    'status', 'project_type', 'construction_stage', 'requirements', 'full_address',
    'preferred_materials', 'progress', 'start_date', 'created_at', 'updated_at',
  ],
  project_milestones: [
    'id', 'project_id', 'title', 'description', 'percentage', 'status',
    'progress', 'due_date', 'expected_end_date', 'start_date', 'completed_at',
    'completed_date', 'updated_at', 'created_at',
  ],
  site_logs: [
    'id', 'project_id', 'contractor_id', 'milestone_id', 'description',
    'image_url', 'created_at',
  ],
  messages: [
    'id', 'project_id', 'sender_id', 'receiver_id', 'message', 'attachment_url',
    'read_at', 'created_at',
  ],
  construction_photos: [
    'id', 'project_id', 'contractor_id', 'milestone_id', 'image_url', 'caption',
    'created_at',
  ],
  budget_items: [
    'id', 'project_id', 'name', 'category', 'estimated', 'spent', 'sort_order',
    'created_at', 'updated_at',
  ],
  construction_materials: [
    'id', 'project_id', 'name', 'category', 'quantity', 'unit', 'estimated_cost',
    'actual_cost', 'supplier', 'sort_order', 'created_at', 'updated_at',
  ],
})) {
  const found = await probeColumns(table, cols);
  console.log(`\n== ${table} ==`);
  if (found.length === 0) {
    console.log('  (could not resolve any columns — table may not exist)');
  } else {
    console.log('  ' + found.join(', '));
  }
}

// Does the legacy `contractors` table exist at all?
{
  const { data, error } = await supabase.from('contractors').select('id').limit(0);
  console.log('\n== contractors ==');
  console.log(error ? `  MISSING [${error.code}] ${error.message}` : `  EXISTS (id readable)`);
}

console.log('\ndone');