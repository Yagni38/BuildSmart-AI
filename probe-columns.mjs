// READ-ONLY schema probe. No writes. No DDL.
// Uses the anon key to test whether candidate columns exist.
// A valid column with RLS returns [] (no error); an invalid column returns an error.
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
  profiles: ['id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'city', 'state', 'location', 'created_at', 'updated_at'],
  contractor_profiles: ['id', 'profile_id', 'full_name', 'email', 'phone', 'location', 'skills', 'experience_years', 'project_types', 'resume_url', 'verification_status', 'rejection_reason', 'created_at', 'updated_at', 'user_id', 'rating', 'company_name', 'bio', 'completed_projects', 'hourly_rate', 'specialty'],
  projects: ['id', 'customer_id', 'contractor_id', 'name', 'building_type', 'city', 'state', 'built_up_area', 'budget', 'budget_min', 'budget_max', 'requirements', 'timeline', 'status', 'stage', 'current_stage', 'progress', 'selected_at', 'start_date', 'created_at', 'updated_at', 'location', 'description', 'original_budget', 'estimated_cost'],
  project_milestones: ['id', 'project_id', 'title', 'name', 'stage', 'status', 'due_date', 'target_date', 'completed_at', 'completion_percent', 'progress', 'expenses_lakhs', 'delay_prediction', 'weather_impact', 'comments', 'photos', 'created_at', 'updated_at', 'description', 'material_cost', 'labour_cost', 'other_cost'],
  site_logs: ['id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'caption', 'image_url', 'photo_url', 'created_at', 'updated_at', 'log_date', 'weather_conditions', 'notes', 'title', 'photo_urls', 'date'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content', 'attachment_url', 'image_url', 'created_at', 'updated_at', 'read'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'status', 'created_at', 'updated_at', 'notes', 'message'],
  contractor_documents: ['id', 'contractor_id', 'profile_id', 'document_type', 'file_url', 'url', 'created_at'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'score', 'status', 'created_at'],
  project_expenses: ['id', 'project_id', 'category', 'amount', 'description', 'created_at'],
  expenses: ['id', 'project_id', 'category', 'amount', 'description', 'created_at'],
  notifications: ['id', 'user_id', 'profile_id', 'title', 'message', 'read', 'created_at'],
  payments: ['id', 'project_id', 'amount', 'status', 'created_at'],
};

const tables = Object.keys(candidates);
const exists = {};
for (const t of tables) {
  const { error } = await supabase.from(t).select('id').limit(0);
  exists[t] = !error;
}
console.log('=== TABLE EXISTENCE (anon) ===');
for (const t of tables) console.log(`  ${exists[t] ? 'YES' : 'NO '}  ${t}`);

console.log('\n=== COLUMN EXISTENCE ===');
for (const [t, cols] of Object.entries(candidates)) {
  const valid = [];
  const missing = [];
  for (const c of cols) {
    if (!exists[t]) { missing.push(c + ' (table?)'); continue; }
    const { error } = await supabase.from(t).select(c).limit(0);
    if (error) missing.push(c);
    else valid.push(c);
  }
  console.log(`\n${t}`);
  console.log('  VALID  :', valid.join(', ') || '-');
  console.log('  MISSING:', missing.join(', ') || '-');
}
