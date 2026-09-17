import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const supabase = createClient(
  get('VITE_SUPABASE_URL'),
  get('VITE_SUPABASE_ANON_KEY')
);

async function checkCols(table, candidates) {
  let valid = [];
  for (const c of candidates) {
    const { error } = await supabase.from(table).select(c).limit(0);
    if (!error) {
      valid.push(c);
    }
  }
  console.log(`Table '${table}' columns (${valid.length}/${candidates.length}):`, valid.join(', '));
}

console.log('=== Checking tables ===');
const tables = {
  profiles: ['id', 'user_id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'created_at', 'updated_at'],
  contractor_profiles: ['id', 'user_id', 'profile_id', 'company_name', 'full_name', 'rating', 'verification_status', 'specialty', 'experience_years', 'hourly_rate', 'location', 'phone', 'email', 'bio', 'completed_projects', 'created_at', 'updated_at'],
  projects: ['id', 'customer_id', 'contractor_id', 'name', 'building_type', 'city', 'state', 'built_up_area', 'budget', 'budget_min', 'budget_max', 'requirements', 'timeline', 'status', 'stage', 'current_stage', 'created_at', 'updated_at', 'location'],
  project_milestones: ['id', 'project_id', 'title', 'name', 'stage', 'status', 'due_date', 'target_date', 'completed_at', 'completion_percent', 'expenses_lakhs', 'delay_prediction', 'weather_impact', 'comments', 'photos', 'created_at', 'updated_at'],
  site_logs: ['id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'caption', 'image_url', 'photo_url', 'created_at', 'updated_at', 'log_date', 'weather_conditions', 'notes'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content', 'attachment_url', 'image_url', 'created_at', 'updated_at']
};

for (const [table, candidates] of Object.entries(tables)) {
  try {
    await checkCols(table, candidates);
  } catch (err) {
    console.error(`Error on ${table}:`, err);
  }
}
