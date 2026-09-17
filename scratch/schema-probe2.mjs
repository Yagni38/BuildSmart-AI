// TEMP READ-ONLY probe round 2 — deeper columns + table existence. No writes.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const H = { apikey: key, Authorization: `Bearer ${key}` };

const tableCandidates = [
  'profiles', 'contractor_profiles', 'projects', 'project_milestones', 'site_logs',
  'construction_photos', 'contractor_documents', 'contractor_matches', 'quotes',
  'budget_items', 'construction_materials', 'messages', 'notifications',
  'project_expenses', 'expenses', 'project_updates', 'milestones', 'project_progress',
  'ai_designs', 'ai_materials', 'ai_project_plans', 'contractors', 'payments',
  'invoices', 'transactions', 'site_photos', 'documents', 'activity_log',
  'project_activity', 'project_notifications', 'user_notifications', 'expense_items',
];

console.log('=== TABLE EXISTENCE ===');
const exists = [];
const absent = [];
for (const t of tableCandidates) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=0`, { headers: H });
  if (r.status === 200 || r.status === 206 || r.status === 204) exists.push(t);
  else if (r.status === 404) absent.push(t);
  else exists.push(`${t} (status ${r.status})`);
}
console.log('EXISTS:', exists.join(', '));
console.log('ABSENT:', absent.join(', '));

const deep = {
  budget_items: ['estimated_cost', 'actual_cost', 'planned_amount', 'cost', 'budget_amount',
    'unit_cost', 'total_amount', 'expense_type', 'item', 'description', 'amount_spent',
    'quantity', 'unit_price', 'total', 'amount', 'notes', 'status'],
  construction_materials: ['rate', 'price', 'cost', 'amount', 'total', 'unit_rate',
    'estimated_cost', 'actual_cost', 'unit_price', 'total_cost', 'status', 'notes', 'description'],
  projects: ['budget_spent', 'actual_cost', 'spent', 'progress_percent', 'contractor_name',
    'customer_name', 'original_budget', 'estimated_cost', 'current_estimate', 'notes',
    'description', 'selected_at', 'start_date', 'end_date'],
  contractor_profiles: ['profile_id', 'user_id'],
  site_logs: ['caption', 'updated_at'],
  notifications: ['is_read'],
};

console.log('\n=== DEEP COLUMN PROBE (raw PostgREST response) ===');
for (const [table, cols] of Object.entries(deep)) {
  console.log(`\n--- ${table}`);
  for (const col of cols) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${col}&limit=0`, { headers: H });
    if (r.status === 200) { console.log(`   OK         ${col}`); continue; }
    const body = await r.text();
    let msg = body;
    try { msg = JSON.parse(body).message ?? body; } catch { /* keep raw */ }
    console.log(`   ${String(r.status).padEnd(4)}       ${col}  ->  ${String(msg).slice(0, 120)}`);
  }
}