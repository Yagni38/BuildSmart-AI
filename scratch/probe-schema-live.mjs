// TEMP READ-ONLY SCHEMA PROBE (scratch).
// Uses the anon key. PostgREST answers `42703 column does not exist` for a
// missing column even when RLS hides the rows, so this reveals the REAL live
// column set without needing a service-role key. No writes of any kind.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};

const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log('project ref:', url);

const CANDIDATES = {
  site_logs: [
    'id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'image_url',
    'created_at', 'updated_at', 'title', 'progress', 'photo_urls', 'photo_url',
    'log_date', 'weather_conditions', 'notes', 'caption', 'photo_caption',
    'stage', 'status', 'completion_percent',
  ],
  project_milestones: [
    'id', 'project_id', 'title', 'name', 'stage', 'status', 'due_date',
    'target_date', 'completed_at', 'completion_percent', 'progress', 'percentage',
    'expenses_lakhs', 'delay_prediction', 'weather_impact', 'comments', 'photos',
    'created_at', 'updated_at', 'description', 'order_index',
  ],
  projects: [
    'id', 'customer_id', 'contractor_id', 'name', 'building_type', 'city', 'state',
    'built_up_area', 'budget', 'budget_min', 'budget_max', 'requirements',
    'timeline', 'status', 'stage', 'current_stage', 'progress', 'created_at',
    'updated_at', 'location', 'description', 'project_type', 'expenses',
    'total_expenses', 'spent_amount', 'material_cost', 'labour_cost',
    'other_expenses', 'estimated_cost', 'original_budget', 'progress_percent',
  ],
  profiles: [
    'id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'created_at',
    'updated_at', 'city', 'state', 'location', 'company_name',
  ],
  contractor_profiles: [
    'id', 'profile_id', 'user_id', 'email', 'full_name', 'phone', 'location',
    'skills', 'experience_years', 'project_types', 'resume_url',
    'verification_status', 'rejection_reason', 'created_at', 'updated_at',
    'rating', 'company_name', 'bio', 'completed_projects', 'hourly_rate',
    'specialty',
  ],
  contractor_documents: ['id', 'contractor_id', 'profile_id', 'document_type', 'file_url', 'created_at'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'status', 'created_at'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'status', 'created_at'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content', 'created_at'],
  expenses: ['id', 'project_id', 'category', 'amount', 'created_at', 'description'],
};

for (const [table, candidates] of Object.entries(CANDIDATES)) {
  const present = [];
  const missing = [];
  for (const col of candidates) {
    const { error } = await supabase.from(table).select(col).limit(0);
    if (!error) present.push(col);
    else if (error.code === '42703' || /does not exist/i.test(error.message)) missing.push(col);
    else present.push(`${col}(?)`); // table-level issue (404 etc.) — flag separately
  }
  console.log(`\n=== ${table} ===`);
  console.log('  EXISTS :', present.join(', ') || '(none)');
  console.log('  MISSING:', missing.join(', ') || '(none)');
}

// Storage buckets: list what the anon role can see + probe specific buckets.
try {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  console.log('\n=== storage.listBuckets ===');
  console.log('  error:', error?.message ?? 'none');
  console.log('  buckets:', (buckets ?? []).map((b) => `${b.name}${b.public ? ' (public)' : ' (private)'}`).join(', ') || '(none visible)');
} catch (e) {
  console.log('\n=== storage.listBuckets ===');
  console.log('  threw:', e.message);
}

for (const bucket of ['site-photos', 'construction-updates', 'construction-progress', 'contractor-resumes', 'resumes', 'documents', 'avatars']) {
  const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1 });
  console.log(`  bucket "${bucket}":`, error ? `ERROR ${error.message}` : `OK rows=${data?.length ?? 0}`);
}