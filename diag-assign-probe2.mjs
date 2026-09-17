// READ-ONLY column-existence probe. Column errors (42703) are raised by
// PostgREST BEFORE RLS is applied, and RLS blocks any actual write from anon,
// so this is safe and modifies nothing.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const H = { apikey: key, Authorization: `Bearer ${key}` };

async function cols(table, candidates) {
  const present = [];
  const missing = [];
  for (const c of candidates) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${c}&limit=1`, { headers: H });
    const body = await r.text();
    if (r.status === 200) present.push(c);
    else if (body.includes('42703')) missing.push(c);
    else missing.push(`${c} (HTTP ${r.status}: ${body.slice(0, 80)})`);
  }
  console.log(`\n== ${table} ==`);
  console.log('  PRESENT: ' + present.join(', '));
  console.log('  MISSING: ' + missing.join(', '));
}

await cols('projects', [
  'selected_at', 'progress', 'start_date', 'contractor_id', 'status',
  'construction_stage', 'budget', 'timeline', 'project_type', 'plot_size',
  'requirements', 'expected_completion',
]);

await cols('contractor_profiles', [
  'user_id', 'company_name', 'description', 'years_of_experience',
  'experience_years', 'rejection_reason', 'id', 'full_name', 'email',
  'phone', 'location', 'skills', 'project_types', 'resume_url',
  'verification_status', 'created_at', 'updated_at',
]);

// What does the REAL assignment UPDATE payload do on the live DB?
// anon has no UPDATE policy, so RLS blocks it either way — but a missing
// column raises 42703 first, which tells us if the payload is even valid.
console.log('\n== probe: assignment UPDATE payload shape (SELECTED_AT test) ==');
const upd = await fetch(`${url}/rest/v1/projects?id=eq.00000000-0000-0000-0000-000000000000`, {
  method: 'PATCH',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    contractor_id: '00000000-0000-0000-0000-000000000000',
    status: 'CONTRACTOR_SELECTED',
    updated_at: new Date().toISOString(),
    selected_at: new Date().toISOString(),
  }),
});
console.log(`  HTTP ${upd.status}: ${(await upd.text()).slice(0, 400)}`);