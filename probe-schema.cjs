// TEMP read-only schema probe (no writes). Prints real column sets per table.
const { readFileSync } = require('node:fs');

const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY');

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function probe(table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (r.status >= 400) {
    console.log(`### ${table}  -> HTTP ${r.status}: ${text.slice(0, 200)}`);
    return;
  }
  const row = Array.isArray(json) ? json[0] : null;
  if (!row) {
    console.log(`### ${table}  (0 rows visible to anon)`);
    return;
  }
  console.log(`### ${table}`);
  console.log('    ' + Object.keys(row).join(', '));
}

const tables = [
  'profiles', 'contractor_profiles', 'projects', 'project_milestones', 'site_logs',
  'contractor_documents', 'contractor_matches', 'quotes', 'messages', 'materials',
  'expenses', 'notifications', 'project_expenses', 'budget_items', 'payments',
  'contractors', 'project_updates', 'milestone_updates',
];

(async () => {
  for (const t of tables) await probe(t);
  // storage buckets
  const b = await fetch(`${url}/storage/v1/bucket`, { headers });
  console.log('### storage buckets -> HTTP ' + b.status);
  console.log((await b.text()).slice(0, 800));
})();
