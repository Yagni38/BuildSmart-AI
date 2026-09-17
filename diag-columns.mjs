// READ-ONLY diagnostic: discover the EXACT live columns of each table.
// Uses PostgREST `select=<col>&limit=0`: HTTP 200 => column exists,
// HTTP 400 (PGRST204) => column does NOT exist. No writes anywhere.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const CANDIDATES = {
  site_logs: ['id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'caption', 'image_url',
    'photo_url', 'log_date', 'notes', 'weather_conditions', 'created_at', 'updated_at', 'title',
    'percentage', 'progress', 'status', 'update_type', 'photos', 'location', 'work_done', 'photos_urls'],
  projects: ['id', 'customer_id', 'contractor_id', 'name', 'description', 'building_type', 'project_type',
    'city', 'state', 'plot_size', 'plot_length', 'plot_width', 'built_up_area', 'floors', 'bedrooms',
    'bathrooms', 'soil_type', 'budget', 'budget_min', 'budget_max', 'expected_completion', 'timeline',
    'priority', 'design_style', 'material_preference', 'sustainability_preference', 'parking',
    'kitchen_type', 'construction_stage', 'requirements', 'status', 'progress', 'start_date',
    'selected_at', 'created_at', 'updated_at', 'spent', 'actual_cost', 'estimated_cost'],
  contractor_profiles: ['id', 'profile_id', 'user_id', 'full_name', 'email', 'phone', 'location', 'skills',
    'experience_years', 'project_types', 'resume_url', 'verification_status', 'rejection_reason',
    'created_at', 'updated_at', 'company_name', 'bio', 'rating', 'completed_projects', 'specialty'],
  project_milestones: ['id', 'project_id', 'title', 'name', 'stage', 'status', 'due_date', 'target_date',
    'completed_at', 'percentage', 'completion_percent', 'expenses_lakhs', 'delay_prediction',
    'weather_impact', 'comments', 'photos', 'sort_order', 'created_at', 'updated_at', 'description'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content', 'created_at',
    'updated_at', 'attachment_url', 'image_url', 'read_at'],
  budget_items: ['id', 'project_id', 'name', 'category', 'estimated', 'spent', 'sort_order', 'created_at', 'updated_at'],
  construction_materials: ['id', 'project_id', 'name', 'category', 'quantity', 'unit', 'estimated_cost',
    'actual_cost', 'supplier', 'sort_order', 'created_at', 'updated_at'],
  construction_photos: ['id', 'project_id', 'contractor_id', 'image_url', 'caption', 'milestone_id', 'created_at'],
  project_updates: ['id', 'project_id', 'author_id', 'title', 'body', 'description', 'update_type',
    'image_url', 'created_at', 'updated_at'],
  contractor_documents: ['id', 'contractor_id', 'profile_id', 'document_type', 'file_name', 'file_url',
    'url', 'name', 'created_at'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'match_score', 'status', 'created_at'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'status', 'description', 'notes',
    'estimated_cost', 'created_at', 'updated_at'],
  profiles: ['id', 'user_id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'city', 'state',
    'created_at', 'updated_at'],
};

for (const [table, cols] of Object.entries(CANDIDATES)) {
  const present = [];
  const absent = [];
  for (const c of cols) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${c}&limit=0`, { headers });
    if (r.status === 200) present.push(c);
    else absent.push(c);
  }
  console.log(`### ${table}`);
  console.log(`  EXISTS : ${present.join(', ') || '(none)'}`);
  if (absent.length) console.log(`  MISSING: ${absent.join(', ')}`);
}
