// READ-ONLY schema probe. No INSERT/UPDATE/DELETE. Safe to run repeatedly.
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

console.log('project:', url);

// ---- 1. Which candidate tables exist? (select with limit 0) ----
const TABLES = [
  'profiles', 'contractor_profiles', 'projects', 'project_milestones',
  'site_logs', 'messages', 'contractor_documents', 'contractor_matches',
  'quotes', 'construction_photos', 'expenses', 'project_expenses',
  'notifications', 'payments', 'material_estimates', 'materials',
  'project_materials', 'milestones', 'project_updates', 'budgets',
];
console.log('\n=== TABLE EXISTENCE (limit 0 probe) ===');
for (const t of TABLES) {
  const { error } = await supabase.from(t).select('id').limit(0);
  const exists = !error || error.code !== 'PGRST205';
  console.log(`${exists ? 'EXISTS ' : 'MISSING'}  ${t}${error ? `   [${error.code}] ${error.message.slice(0, 90)}` : ''}`);
}

// ---- 2. Column existence per table ----
const COLS = {
  profiles: ['id','email','full_name','role','phone','avatar_url','created_at','updated_at','user_id','city','state','location'],
  contractor_profiles: ['id','profile_id','user_id','full_name','email','phone','location','skills','experience_years','project_types','resume_url','verification_status','rejection_reason','created_at','updated_at'],
  projects: ['id','customer_id','contractor_id','name','description','building_type','project_type','city','state','plot_size','built_up_area','floors','bedrooms','bathrooms','budget','budget_min','budget_max','expected_completion','timeline','status','construction_stage','requirements','created_at','updated_at','progress','start_date','selected_at','current_stage','stage'],
  project_milestones: ['id','project_id','title','name','description','status','stage','progress','progress_percent','completion_percent','due_date','target_date','completed_at','completed_date','notes','created_at','updated_at'],
  site_logs: ['id','project_id','contractor_id','milestone_id','description','caption','image_url','photo_url','created_at','updated_at','log_date','weather_conditions','notes','title'],
  messages: ['id','project_id','sender_id','receiver_id','message','text','content','attachment_url','image_url','created_at','updated_at','read_at','sender_type'],
};
console.log('\n=== COLUMNS (limit 0 probe) ===');
for (const [t, cols] of Object.entries(COLS)) {
  const valid = [];
  for (const c of cols) {
    const { error } = await supabase.from(t).select(c).limit(0);
    if (!error) valid.push(c);
  }
  console.log(`\n${t} (${valid.length}/${cols.length})`);
  console.log('  VALID  :', valid.join(', ') || '(none)');
  console.log('  INVALID:', cols.filter((c) => !valid.includes(c)).join(', ') || '(none)');
}

// ---- 3. Storage buckets ----
console.log('\n=== STORAGE BUCKETS ===');
for (const b of ['site-photos', 'construction-updates', 'contractor-resumes', 'resumes', 'avatars', 'documents']) {
  const { data, error } = await supabase.storage.from(b).list('', { limit: 1 });
  console.log(`bucket ${b}: ${error ? `ERR [${error.message}]` : `OK (entries: ${data?.length ?? 0})`}`);
}

// ---- 4. anon-visible row counts (RLS filtered) ----
console.log('\n=== ANON-VISIBLE COUNTS (RLS filtered) ===');
for (const t of ['profiles', 'contractor_profiles', 'projects', 'project_milestones', 'site_logs', 'messages', 'quotes', 'contractor_documents', 'contractor_matches']) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${error ? `ERR [${error.code}]` : count}`);
}