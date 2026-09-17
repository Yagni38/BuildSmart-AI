import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const supabase = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });

const CANDIDATES = {
  project_updates: ['id', 'project_id', 'contractor_id', 'author_id', 'user_id', 'update_type', 'type', 'title', 'content', 'description', 'image_url', 'photo_url', 'milestone_id', 'progress', 'created_at', 'updated_at', 'status'],
  notifications: ['id', 'user_id', 'profile_id', 'recipient_id', 'title', 'message', 'body', 'type', 'read', 'is_read', 'link', 'created_at', 'project_id', 'contractor_id'],
  construction_photos: ['id', 'project_id', 'contractor_id', 'milestone_id', 'image_url', 'caption', 'description', 'created_at', 'storage_path', 'url'],
  contractors: ['id', 'email', 'full_name', 'company_name', 'phone', 'location', 'specialty', 'rating', 'verified', 'verification_status', 'status', 'created_at', 'user_id', 'profile_id'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'status', 'description', 'created_at', 'updated_at', 'notes', 'title'],
  contractor_documents: ['id', 'contractor_id', 'document_type', 'file_url', 'file_name', 'created_at'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'match_score', 'score', 'created_at', 'status', 'reason'],
};

for (const [table, cols] of Object.entries(CANDIDATES)) {
  const present = [];
  const missing = [];
  for (const c of cols) {
    const { error } = await supabase.from(table).select(c).limit(0);
    if (!error) present.push(c);
    else if (error.code === '42703' || /does not exist/i.test(error.message) && !/schema cache/i.test(error.message)) missing.push(c);
    else missing.push(`${c}[${error.code}]`);
  }
  console.log(`\n=== ${table} ===\n  EXISTS : ${present.join(', ') || '(none)'}\n  MISSING: ${missing.join(', ') || '(none)'}`);
}