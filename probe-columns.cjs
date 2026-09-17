// TEMP read-only column prober (no writes).
// For each candidate column: select=<col>&limit=0 -> 200 means EXISTS, 42703 means missing.
const { readFileSync } = require('node:fs');

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function cols(table, candidates) {
  const found = [];
  const missing = [];
  for (const c of candidates) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${c}&limit=0`, { headers });
    if (r.status === 200) found.push(c);
    else missing.push(c);
  }
  console.log(`\n### ${table}`);
  console.log('  EXISTS : ' + (found.join(', ') || '(none)'));
  console.log('  MISSING: ' + (missing.join(', ') || '(none)'));
}

const tables = {
  profiles: ['id', 'user_id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'city', 'state', 'location', 'company_name', 'bio', 'created_at', 'updated_at', 'status', 'verified'],
  contractor_profiles: ['id', 'user_id', 'profile_id', 'full_name', 'email', 'phone', 'location', 'skills', 'experience_years', 'project_types', 'resume_url', 'verification_status', 'rejection_reason', 'created_at', 'updated_at', 'rating', 'company_name', 'bio', 'completed_projects', 'hourly_rate', 'verified'],
  projects: ['id', 'customer_id', 'contractor_id', 'name', 'building_type', 'city', 'state', 'built_up_area', 'budget', 'budget_min', 'budget_max', 'requirements', 'timeline', 'status', 'stage', 'current_stage', 'progress', 'created_at', 'updated_at', 'location', 'start_date', 'selected_at', 'estimated_cost', 'original_budget', 'total_spent', 'spent'],
  project_milestones: ['id', 'project_id', 'title', 'name', 'stage', 'status', 'due_date', 'target_date', 'completed_at', 'completion_percent', 'expenses_lakhs', 'delay_prediction', 'weather_impact', 'comments', 'photos', 'progress', 'order_index', 'created_at', 'updated_at', 'description'],
  site_logs: ['id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'image_url', 'photo_url', 'caption', 'notes', 'log_date', 'weather_conditions', 'created_at', 'updated_at', 'progress', 'created_by'],
  project_updates: ['id', 'project_id', 'contractor_id', 'author_id', 'update_type', 'title', 'content', 'description', 'image_url', 'created_at', 'updated_at', 'milestone_id', 'progress'],
  notifications: ['id', 'user_id', 'profile_id', 'recipient_id', 'project_id', 'title', 'message', 'body', 'type', 'read', 'is_read', 'created_at', 'updated_at', 'link'],
  budget_items: ['id', 'project_id', 'category', 'name', 'item_name', 'amount', 'estimated_cost', 'actual_cost', 'quantity', 'unit', 'unit_cost', 'created_at', 'updated_at', 'type', 'notes'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'total', 'status', 'description', 'created_at', 'updated_at', 'materials_cost', 'labour_cost', 'other_cost', 'valid_until', 'notes'],
  contractor_documents: ['id', 'contractor_id', 'profile_id', 'document_type', 'file_url', 'url', 'name', 'created_at', 'updated_at', 'verified', 'status'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'score', 'match_score', 'status', 'created_at', 'updated_at', 'recommendation', 'reasons'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content', 'attachment_url', 'image_url', 'created_at', 'updated_at', 'read', 'is_read'],
  contractors: ['id', 'name', 'email', 'phone', 'specialty', 'verified', 'created_at', 'updated_at', 'location', 'rating', 'profile_id'],
};

(async () => {
  for (const [t, c] of Object.entries(tables)) await cols(t, c);
})();