// READ-ONLY schema probe: validates which columns exist on each table.
// Uses `select=<col>&limit=0` so NO rows are returned and NO data is written.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const candidates = {
  profiles: [
    'id', 'user_id', 'email', 'full_name', 'name', 'role', 'phone', 'avatar_url',
    'city', 'state', 'location', 'created_at', 'updated_at', 'verified',
  ],
  contractor_profiles: [
    'id', 'profile_id', 'user_id', 'full_name', 'email', 'phone', 'location',
    'skills', 'experience_years', 'project_types', 'resume_url', 'verification_status',
    'rejection_reason', 'company_name', 'rating', 'hourly_rate', 'bio', 'completed_projects',
    'verified_at', 'created_at', 'updated_at', 'specialty',
  ],
  projects: [
    'id', 'customer_id', 'contractor_id', 'name', 'description', 'building_type',
    'city', 'state', 'location', 'budget', 'budget_min', 'budget_max', 'built_up_area',
    'requirements', 'timeline', 'status', 'stage', 'current_stage', 'progress',
    'progress_percent', 'selected_at', 'start_date', 'created_at', 'updated_at',
    'estimated_cost', 'original_budget', 'total_spent', 'spent',
  ],
  project_milestones: [
    'id', 'project_id', 'title', 'name', 'description', 'stage', 'status',
    'due_date', 'target_date', 'completed_at', 'completion_percent',
    'expenses_lakhs', 'delay_prediction', 'weather_impact', 'comments', 'photos',
    'order_index', 'sort_order', 'created_at', 'updated_at',
  ],
  site_logs: [
    'id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'caption',
    'image_url', 'photo_url', 'photos', 'log_date', 'date', 'created_at', 'updated_at',
    'weather_conditions', 'notes', 'title', 'progress_percent', 'status', 'stage',
  ],
  contractor_documents: [
    'id', 'contractor_id', 'profile_id', 'document_type', 'doc_type', 'title', 'name',
    'file_url', 'url', 'storage_path', 'file_name', 'file_path', 'uploaded_at', 'created_at',
  ],
  contractor_matches: [
    'id', 'project_id', 'contractor_id', 'profile_id', 'match_score', 'score',
    'status', 'recommended_at', 'created_at', 'updated_at',
  ],
  quotes: [
    'id', 'project_id', 'contractor_id', 'amount', 'total_amount', 'status',
    'description', 'notes', 'created_at', 'updated_at', 'valid_until',
  ],
  messages: [
    'id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content',
    'attachment_url', 'image_url', 'read', 'is_read', 'created_at', 'updated_at',
  ],
  notifications: ['id', 'user_id', 'profile_id', 'title', 'message', 'body', 'read', 'is_read', 'created_at'],
  payments: ['id', 'project_id', 'customer_id', 'contractor_id', 'amount', 'status', 'created_at'],
  expenses: [
    'id', 'project_id', 'category', 'type', 'amount', 'description', 'created_at',
    'milestone_id', 'recorded_by',
  ],
  project_expenses: ['id', 'project_id', 'category', 'amount', 'description', 'created_at'],
  material_estimates: ['id', 'project_id', 'material_name', 'quantity', 'unit', 'rate', 'amount', 'created_at'],
  project_updates: ['id', 'project_id', 'contractor_id', 'description', 'image_url', 'created_at'],
};

const exists = async (table) => {
  const { error } = await supabase.from(table).select('*').limit(0);
  if (!error) return { ok: true };
  if (error.code === '42P01' || /does not exist|Could not find the table/i.test(error.message)) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, note: error.message };
};

for (const [table, cols] of Object.entries(candidates)) {
  const t = await exists(table);
  if (!t.ok) {
    console.log(`\n== ${table}: TABLE NOT FOUND ==`);
    continue;
  }
  console.log(`\n== ${table} ==`);
  const valid = [];
  for (const c of cols) {
    const { error } = await supabase.from(table).select(c).limit(0);
    if (!error) valid.push(c);
  }
  console.log('  columns present: ' + valid.join(', '));
  const missing = cols.filter((c) => !valid.includes(c));
  console.log('  NOT present   : ' + (missing.join(', ') || '(none)'));
}
