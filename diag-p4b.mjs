// TEMPORARY Phase 4 diagnostic — enumerate the real projects table columns
// behaviorally (PostgREST rejects unknown columns with the column name),
// and probe RLS write behavior WITHOUT leaving junk rows.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_PUBLISHABLE_KEY');
const supabase = createClient(url, key);

const email = `bs-p4c-${Date.now()}@example.com`;
const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password: 'P4Pass123!',
  options: { data: { full_name: 'P4 Col Test', role: 'CUSTOMER', phone: null } },
});
if (suErr) { console.error('signUp:', suErr.message); process.exit(1); }
const uid = su.user.id;
console.log('uid:', uid);

const candidates = [
  'id', 'customer_id', 'contractor_id', 'name', 'project_name', 'description',
  'building_type', 'project_type', 'type', 'location', 'address', 'city', 'state',
  'plot_size', 'plot_size_sqft', 'built_up_area', 'floors', 'bedrooms', 'bathrooms',
  'budget_min', 'budget_max', 'budget', 'expected_budget', 'total_budget_lakhs',
  'expected_completion_date', 'construction_stage', 'stage', 'requirements',
  'soil_type', 'status', 'start_date', 'created_at', 'updated_at', 'priority', 'design_style',
];

const found = [];
const missing = [];
for (const col of candidates) {
  const { data, error } = await supabase.from('projects').select(col).limit(1);
  if (error) {
    const msg = error.message || '';
    const code = error.code || '';
    if (msg.toLowerCase().includes('find') || code === 'PGRST204' || String(code) === '42P01') {
      missing.push(col);
    } else {
      found.push(`${col} (ERR ${code}: ${msg})`);
    }
  } else {
    found.push(col);
  }
}

console.log('\n=== FOUND columns ===');
console.log(found.map((c) => `  ${c}`).join('\n'));
console.log('\n=== NOT findable columns ===');
console.log(missing.map((c) => `  ${c}`).join('\n'));

// Does INSERT (even a minimal one) get past RLS? Try a self-row insert and
// then attempt to clean it up if it lands. If insert is denied we learn that.
const ins = await supabase.from('projects').insert({ customer_id: uid }).select('id').maybeSingle();
console.log('\nINSERT probe (customer_id only):');
if (ins.error) {
  console.log('  denied/errored:', ins.error.code, ins.error.message);
} else {
  console.log('  INSERT ALLOWED id=', ins.data?.id, '— attempting cleanup');
  const del = await supabase.from('projects').delete().eq('id', ins.data.id);
  console.log('  cleanup delete:', del.error ? `denied ${del.error.code} ${del.error.message}` : 'OK removed');
}