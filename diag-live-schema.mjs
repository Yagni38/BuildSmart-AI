// READ-ONLY live schema probe (same pattern as diag-schema.mjs).
// Discovers the ACTUAL columns of each table by iteratively removing the
// column PostgREST reports as missing, until the select succeeds.
// Uses ONLY the public anon key. No writes, no deletes, no configuration
// changes. Column validation happens BEFORE RLS, so this works even when
// anon cannot read rows.
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

const CANDIDATES = {
  profiles: [
    'id', 'user_id', 'email', 'full_name', 'name', 'role', 'phone', 'city',
    'state', 'location', 'avatar_url', 'bio', 'company_name', 'created_at',
    'updated_at',
  ],
  contractor_profiles: [
    'id', 'profile_id', 'user_id', 'full_name', 'email', 'phone', 'location',
    'skills', 'experience_years', 'project_types', 'resume_url',
    'verification_status', 'rejection_reason', 'company_name', 'rating',
    'specialty', 'bio', 'completed_projects', 'created_at', 'updated_at',
  ],
  projects: [
    'id', 'customer_id', 'contractor_id', 'selected_at', 'name', 'description',
    'project_type', 'building_type', 'full_address', 'city', 'state',
    'location', 'plot_size', 'plot_length', 'plot_width', 'built_up_area',
    'floors', 'bedrooms', 'bathrooms', 'soil_type', 'budget', 'budget_min',
    'budget_max', 'total_budget', 'estimated_cost', 'expected_completion',
    'expected_completion_date', 'timeline', 'start_date', 'priority',
    'design_style', 'material_preference', 'preferred_materials',
    'sustainability_preference', 'parking', 'kitchen_type',
    'construction_stage', 'requirements', 'progress', 'status',
    'created_at', 'updated_at',
  ],
  project_milestones: [
    'id', 'project_id', 'contractor_id', 'title', 'name', 'description',
    'status', 'progress', 'percentage', 'completion_percent', 'order_index',
    'sort_order', 'start_date', 'expected_end_date', 'end_date', 'due_date',
    'target_date', 'completed_date', 'completed_at', 'expenses_lakhs',
    'budget', 'spent', 'delay_prediction', 'weather_impact', 'comments',
    'notes', 'photos', 'created_at', 'updated_at',
  ],
  site_logs: [
    'id', 'project_id', 'contractor_id', 'logged_by', 'milestone_id',
    'description', 'details', 'text', 'title', 'caption', 'image_url',
    'photo_url', 'photo_urls', 'log_date', 'update_date', 'logged_at',
    'weather_conditions', 'notes', 'progress', 'expenses_lakhs', 'created_at',
    'updated_at',
  ],
  messages: [
    'id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'body',
    'content', 'attachment_url', 'read_at', 'is_read', 'created_at',
    'updated_at',
  ],
  budget_items: [
    'id', 'project_id', 'name', 'category', 'estimated', 'spent', 'sort_order',
    'created_at', 'updated_at',
  ],
  construction_materials: [
    'id', 'project_id', 'name', 'category', 'quantity', 'unit',
    'estimated_cost', 'actual_cost', 'supplier', 'recommendation',
    'sort_order', 'created_at', 'updated_at',
  ],
  quotes: [
    'id', 'project_id', 'contractor_id', 'customer_id', 'amount_lakhs',
    'amount', 'description', 'status', 'valid_until', 'created_at',
    'updated_at',
  ],
  contractor_documents: [
    'id', 'contractor_id', 'contractor_profile_id', 'profile_id',
    'document_type', 'file_url', 'file_name', 'url', 'name', 'status',
    'uploaded_at', 'created_at', 'updated_at',
  ],
  contractor_matches: [
    'id', 'project_id', 'contractor_id', 'match_score', 'match_reason',
    'created_at',
  ],
  notifications: [
    'id', 'user_id', 'profile_id', 'type', 'title', 'message', 'is_read',
    'read_at', 'created_at',
  ],
};

console.log('== live schema discovery (anon, read-only) ==');
console.log('project:', get('VITE_SUPABASE_URL'));
console.log('');

for (const [table, candidates] of Object.entries(CANDIDATES)) {
  let remaining = [...candidates];
  let unexpected = null;

  for (let i = 0; i < candidates.length; i++) {
    const { error } = await supabase.from(table).select(remaining.join(',')).limit(1);
    if (!error) break;

    const quoted = [...error.message.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const bare = error.message.match(/column\s+(?:[a-zA-Z_]+\.)?([a-zA-Z_]+)\s+does not exist/);
    const reported = bare ? [...quoted, bare[1]] : quoted;
    const missing = reported.filter((q) => remaining.includes(q));
    if (missing.length === 0) {
      unexpected = `${error.code} — ${error.message}`;
      remaining = [];
      break;
    }
    remaining = remaining.filter((c) => !missing.includes(c));
  }

  if (unexpected) {
    console.log(`${table}: UNEXPECTED ${unexpected}`);
  } else if (remaining.length > 0) {
    console.log(`${table} CONFIRMED COLUMNS (${remaining.length}):`);
    console.log('   ' + remaining.join(', '));
  } else {
    console.log(`${table}: no candidate column survived`);
  }
}

console.log('');
console.log('== row counts (RLS-limited, anon) ==');
for (const table of Object.keys(CANDIDATES)) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  console.log(`${table}: ${error ? 'ERROR ' + error.code : count}`);
}

console.log('done');
