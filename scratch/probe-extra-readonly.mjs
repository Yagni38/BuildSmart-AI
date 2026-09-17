// READ-ONLY probe (no INSERT/UPDATE/DELETE) for the tables the new features need:
// notifications, construction_photos, project_updates, contractor_documents,
// quotes, contractor_matches. Also re-checks storage buckets definitively.
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

const CANDIDATES = {
  notifications: [
    'id', 'user_id', 'profile_id', 'recipient_id', 'title', 'message', 'body',
    'content', 'type', 'read', 'is_read', 'read_at', 'link', 'project_id',
    'contractor_id', 'created_at', 'updated_at',
  ],
  construction_photos: [
    'id', 'project_id', 'contractor_id', 'milestone_id', 'image_url',
    'photo_url', 'caption', 'description', 'created_at', 'updated_at',
  ],
  project_updates: [
    'id', 'project_id', 'contractor_id', 'author_id', 'update_type', 'type',
    'title', 'content', 'description', 'image_url', 'created_at', 'updated_at',
  ],
  contractor_documents: [
    'id', 'contractor_id', 'profile_id', 'document_type', 'doc_type', 'title',
    'name', 'file_url', 'url', 'storage_path', 'file_name', 'file_path',
    'verified', 'status', 'uploaded_at', 'created_at',
  ],
  quotes: [
    'id', 'project_id', 'contractor_id', 'amount', 'total_amount', 'status',
    'description', 'notes', 'created_at', 'updated_at', 'valid_until',
  ],
  contractor_matches: [
    'id', 'project_id', 'contractor_id', 'profile_id', 'match_score', 'score',
    'status', 'recommended_at', 'created_at', 'updated_at',
  ],
  // budget / expense candidates (section 7)
  budget_items: ['id', 'project_id', 'name', 'category', 'estimated', 'spent', 'sort_order', 'created_at'],
  construction_materials: ['id', 'project_id', 'name', 'category', 'quantity', 'unit', 'estimated_cost', 'actual_cost', 'supplier', 'sort_order', 'created_at'],
};

console.log('project:', url);
console.log('\n=== EXTRA TABLE COLUMNS (limit 0 probe) ===');
for (const [t, cols] of Object.entries(CANDIDATES)) {
  const { error: e0 } = await supabase.from(t).select('*').limit(0);
  if (e0 && /Could not find the table|does not exist/i.test(e0.message)) {
    console.log(`\n== ${t}: TABLE NOT FOUND ==`);
    continue;
  }
  const valid = [];
  for (const c of cols) {
    const { error } = await supabase.from(t).select(c).limit(0);
    if (!error) valid.push(c);
  }
  console.log(`\n== ${t} == (${valid.length}/${cols.length})`);
  console.log('  present: ' + (valid.join(', ') || '(none)'));
  console.log('  absent : ' + (cols.filter((c) => !valid.includes(c)).join(', ') || '(none)'));
}

console.log('\n=== ROW COUNTS (RLS-filtered, anon) ===');
for (const t of Object.keys(CANDIDATES)) {
  const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
  console.log(`${t}: ${error ? `ERR [${error.code}] ${error.message.slice(0, 70)}` : count}`);
}

console.log('\n=== STORAGE BUCKET EXISTENCE (definitive: GET object listing) ===');
for (const b of ['site-photos', 'construction-updates', 'contractor-resumes', 'resumes', 'avatars', 'documents', 'ai-designs']) {
  const r = await fetch(`${url}/storage/v1/object/list/${b}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1 }),
  });
  const txt = (await r.text()).slice(0, 130);
  console.log(`bucket ${b}: HTTP ${r.status} ${txt}`);
}

console.log('\nDone. No data was written, changed or deleted.');
