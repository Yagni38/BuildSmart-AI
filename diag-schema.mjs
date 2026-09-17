// READ-ONLY schema probe (mirrors the existing diag-*.mjs pattern).
// Verifies, with ONLY the public anon key:
//   1. the messages / project_milestones / quotes tables exist
//   2. every column the orphaned services (messageService / milestoneService /
//      quoteService) expect actually exists (a missing column returns PGRST204)
//   3. whether anon can see any rows (RLS sanity signal only)
// No writes, no deletes, no configuration changes.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};

const supabase = createClient(
  get('VITE_SUPABASE_URL'),
  get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY')
);

const TABLE_COLUMNS = {
  messages:
    'id,project_id,sender_id,sender_type,text,attachment_type,attachment_name,attachment_url,created_at',
  project_milestones:
    'id,project_id,name,status,completion_percent,expenses_lakhs,target_date,delay_prediction,weather_impact,comments,photos,created_at,updated_at',
  quotes:
    'id,project_id,contractor_id,customer_id,amount_lakhs,description,status,valid_until,created_at,updated_at',
};

console.log('== schema probe (anon, read-only) ==');

for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
  const { data, error } = await supabase.from(table).select(columns).limit(1);

  if (error) {
    console.log(`${table}: ERROR ${error.code} — ${error.message}`);
    continue;
  }

  const rows = Array.isArray(data) ? data.length : 0;
  console.log(
    `${table}: columns OK ✓ | anon-visible rows in first page: ${rows}` +
      (rows > 0 ? '  ⚠ anon can read rows (check RLS)' : ' (empty or RLS-blocked for anon)')
  );
}

// ---------------------------------------------------------------
// Column discovery: the expected columns do not match the live DB,
// so discover the REAL columns by iteratively removing the column
// PostgREST complains about until the select succeeds.
// ---------------------------------------------------------------
const CANDIDATES = {
  messages: [
    'id', 'project_id', 'customer_id', 'contractor_id', 'sender_id',
    'sender_type', 'sender_role', 'sender', 'sender_name', 'author_name',
    'user_id', 'profile_id', 'text', 'message', 'body', 'content',
    'attachment_type', 'attachment_name', 'attachment_url', 'attachment',
    'is_read', 'read_at', 'seen', 'reply_to', 'created_at', 'updated_at',
    'sent_at', 'time',
  ],
  project_milestones: [
    'id', 'project_id', 'contractor_id', 'customer_id', 'name', 'title',
    'milestone_name', 'description', 'status', 'completion_percent',
    'progress', 'progress_percent', 'percent', 'percent_complete',
    'expenses_lakhs', 'expenses', 'expense', 'expense_lakhs',
    'amount_spent', 'amount', 'budget', 'spent', 'target_date', 'due_date',
    'start_date', 'end_date', 'completed_at', 'delay_prediction', 'delay',
    'weather_impact', 'weather', 'comments', 'comment', 'notes', 'photos',
    'photo_urls', 'image_urls', 'created_at', 'updated_at',
  ],
  quotes: [
    'id', 'project_id', 'contractor_id', 'customer_id', 'customer',
    'contractor_name', 'customer_name', 'amount_lakhs', 'amount',
    'amount_inr', 'amount_min', 'amount_max', 'price', 'total_amount',
    'quote_amount', 'currency', 'title', 'name', 'description', 'details',
    'notes', 'status', 'valid_until', 'expires_at', 'created_at',
    'updated_at',
  ],
};

console.log('== live column discovery ==');

for (const [table, candidates] of Object.entries(CANDIDATES)) {
  let remaining = [...candidates];
  const found = [];

  for (let i = 0; i < candidates.length; i++) {
    const { error } = await supabase.from(table).select(remaining.join(',')).limit(1);
    if (!error) break;

    const quoted = [...error.message.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const bare = error.message.match(/column\s+(?:[a-zA-Z_]+\.)?([a-zA-Z_]+)\s+does not exist/);
    const reported = bare ? [...quoted, bare[1]] : quoted;
    const missing = reported.filter((q) => remaining.includes(q));
    if (missing.length === 0) {
      console.log(`${table}: unexpected error ${error.code} — ${error.message}`);
      remaining = [];
      break;
    }
    remaining = remaining.filter((c) => !missing.includes(c));
  }

  if (remaining.length > 0) {
    console.log(`${table} live columns: ${remaining.join(', ')}`);
  }
}

console.log('done');

