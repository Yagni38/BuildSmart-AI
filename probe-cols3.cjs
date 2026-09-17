// TEMP read-only probe #3 (no writes) — verify PROJECT_COLUMNS + milestone cols.
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

const PROJECT_COLUMNS = ['id','customer_id','contractor_id','name','description','building_type','project_type','city','state','plot_size','plot_length','plot_width','built_up_area','floors','bedrooms','bathrooms','soil_type','budget','budget_min','budget_max','expected_completion','timeline','priority','design_style','material_preference','sustainability_preference','parking','kitchen_type','construction_stage','requirements','status','created_at','updated_at'];

(async () => {
  await cols('projects', PROJECT_COLUMNS);
  await cols('project_milestones', ['id','project_id','title','status','due_date','completed_at','progress','created_at','updated_at','description','percentage','sort_order','order_index','stage']);
  // live function bodies
  const r = await fetch(`${url}/rest/v1/rpc/is_admin`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
  console.log('\n### rpc is_admin -> HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
})();