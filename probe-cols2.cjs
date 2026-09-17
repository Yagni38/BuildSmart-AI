// TEMP read-only probe #2 (no writes).
const { readFileSync } = require('node:fs');
const env = readFileSync('.env.local', 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function cols(table, candidates) {
  const found = [], missing = [];
  for (const c of candidates) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${c}&limit=0`, { headers });
    (r.status === 200 ? found : missing).push(c);
  }
  console.log(`\n### ${table}\n  EXISTS : ${found.join(', ') || '(none)'}\n  MISSING: ${missing.join(', ') || '(none)'}`);
}

const tables = {
  budget_items: ['id', 'project_id', 'name', 'category', 'estimated', 'spent', 'sort_order', 'created_at', 'updated_at'],
  construction_materials: ['id', 'project_id', 'name', 'category', 'quantity', 'unit', 'estimated_cost', 'actual_cost', 'supplier', 'sort_order', 'created_at', 'updated_at'],
  construction_photos: ['id', 'project_id', 'contractor_id', 'image_url', 'caption', 'milestone_id', 'created_at'],
  ai_materials: ['id', 'project_id', 'name', 'quantity', 'unit', 'rate', 'amount', 'created_at'],
  ai_project_plans: ['id', 'project_id', 'plan', 'created_at'],
};

(async () => {
  for (const [t, c] of Object.entries(tables)) await cols(t, c);

  // Bucket existence: try public URL listing (works only for public buckets)
  for (const b of ['construction-updates', 'site-photos', 'contractor-resumes', 'resumes']) {
    const r = await fetch(`${url}/storage/v1/object/list/${b}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 5 }),
    });
    console.log(`BUCKET ${b} -> HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
})();