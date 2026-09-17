// TEMP READ-ONLY schema probe — validates which columns exist live via PostgREST.
// No writes. Deleted after use.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const candidates = {
  site_logs: ['id', 'project_id', 'contractor_id', 'milestone_id', 'description', 'caption',
    'image_url', 'photo_url', 'notes', 'log_date', 'weather_conditions', 'created_at', 'updated_at',
    'title', 'progress', 'status', 'logged_at', 'date', 'customer_id', 'profile_id'],
  projects: ['id', 'customer_id', 'contractor_id', 'name', 'building_type', 'city', 'state',
    'built_up_area', 'budget', 'budget_min', 'budget_max', 'requirements', 'timeline', 'status',
    'stage', 'current_stage', 'created_at', 'updated_at', 'location', 'progress',
    'original_budget', 'estimated_cost', 'spent_amount', 'total_spent'],
  contractor_profiles: ['id', 'profile_id', 'user_id', 'full_name', 'email', 'phone', 'location',
    'skills', 'experience_years', 'project_types', 'resume_url', 'verification_status',
    'rejection_reason', 'created_at', 'company_name', 'rating', 'specialty', 'bio'],
  profiles: ['id', 'email', 'full_name', 'role', 'phone', 'avatar_url', 'created_at', 'updated_at',
    'city', 'state', 'location'],
  project_milestones: ['id', 'project_id', 'title', 'name', 'description', 'status', 'due_date',
    'target_date', 'completed_at', 'completion_percent', 'expenses_lakhs', 'delay_prediction',
    'weather_impact', 'comments', 'photos', 'created_at', 'updated_at', 'progress', 'start_date',
    'expected_end_date', 'completed_date'],
  construction_photos: ['id', 'project_id', 'contractor_id', 'image_url', 'caption', 'milestone_id', 'created_at'],
  budget_items: ['id', 'project_id', 'category', 'item_name', 'name', 'quantity', 'unit',
    'unit_price', 'total', 'amount', 'created_at', 'updated_at', 'notes'],
  construction_materials: ['id', 'project_id', 'name', 'material_name', 'quantity', 'unit',
    'unit_price', 'total_cost', 'supplier', 'status', 'created_at', 'updated_at', 'category'],
  messages: ['id', 'project_id', 'sender_id', 'receiver_id', 'message', 'text', 'content',
    'attachment_url', 'image_url', 'created_at', 'updated_at', 'read_at'],
  contractor_matches: ['id', 'project_id', 'contractor_id', 'match_score', 'status', 'created_at',
    'recommendation_score', 'score'],
  quotes: ['id', 'project_id', 'contractor_id', 'amount', 'status', 'created_at', 'updated_at',
    'description', 'valid_until', 'line_items'],
  contractor_documents: ['id', 'contractor_id', 'document_type', 'file_url', 'file_name',
    'created_at', 'url', 'name', 'doc_type'],
  notifications: ['id', 'user_id', 'title', 'message', 'read', 'created_at', 'type', 'is_read'],
  payments: ['id', 'project_id', 'amount', 'status', 'created_at', 'customer_id', 'milestone_id'],
  expenses: ['id', 'project_id', 'category', 'amount', 'created_at', 'description', 'date'],
};

async function probe(table, cols) {
  const results = { exists: [], missing: [], blocked: [] };
  for (const col of cols) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${col}&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (r.status === 200) results.exists.push(col);
    else {
      const body = await r.text();
      if (/42703|does not exist/i.test(body)) results.missing.push(col);
      else results.blocked.push(`${col} [${r.status}] ${body.slice(0, 120)}`);
    }
  }
  return results;
}

console.log('=== LIVE SCHEMA PROBE (read-only) ===\n');
for (const [table, cols] of Object.entries(candidates)) {
  try {
    const r = await probe(table, cols);
    if (r.exists.length === 0 && r.missing.length === cols.length) {
      console.log(`--- ${table}: TABLE DOES NOT EXIST`);
      continue;
    }
    console.log(`--- ${table}`);
    console.log(`    EXISTS (${r.exists.length}): ${r.exists.join(', ')}`);
    if (r.missing.length) console.log(`    MISSING (${r.missing.length}): ${r.missing.join(', ')}`);
    if (r.blocked.length) console.log(`    OTHER: ${r.blocked.join(' | ')}`);
    console.log();
  } catch (e) {
    console.log(`--- ${table}: ERROR ${e.message}\n`);
  }
}
