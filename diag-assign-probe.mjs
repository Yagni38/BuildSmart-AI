// READ-ONLY diagnostic probe for the contractor-assignment flow.
// Uses ONLY the public anon key (RLS enforced). No writes, no schema changes.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');
const H = { apikey: key, Authorization: `Bearer ${key}` };

// 1) LIVE SCHEMA via PostgREST OpenAPI (authoritative column list)
const specRes = await fetch(`${url}/rest/v1/`, { headers: H });
const spec = await specRes.json();

for (const t of ['profiles', 'contractor_profiles', 'projects', 'project_milestones', 'site_logs']) {
  const d = spec.definitions?.[t];
  console.log(`== ${t} ==`);
  console.log(d ? '  ' + Object.keys(d.properties).join(', ') : '  NOT EXPOSED / NO ROWS');
}

// 2) Does contractor_profiles actually have user_id? (42703 => column absent)
console.log('\n== probe: contractor_profiles.user_id ==');
const uidRes = await fetch(
  `${url}/rest/v1/contractor_profiles?select=id,user_id,email,full_name,verification_status&limit=5`,
  { headers: H },
);
console.log(`  HTTP ${uidRes.status}`);
console.log('  ' + (await uidRes.text()).slice(0, 600));

// 3) Verified contractor rows actually visible to anon (id mapping evidence)
console.log('\n== probe: contractor_profiles (id-only select) ==');
const cpRes = await fetch(
  `${url}/rest/v1/contractor_profiles?select=id,email,full_name,verification_status&limit=20`,
  { headers: H },
);
console.log(`  HTTP ${cpRes.status}`);
const cpText = await cpRes.text();
console.log('  ' + cpText.slice(0, 1200));

// 4) projects: is contractor_id exposed + any rows anon can see
console.log('\n== probe: projects (anon read) ==');
const prRes = await fetch(
  `${url}/rest/v1/projects?select=id,name,status,contractor_id,customer_id,construction_stage&limit=20`,
  { headers: H },
);
console.log(`  HTTP ${prRes.status}`);
console.log('  ' + (await prRes.text()).slice(0, 1200));

// 5) milestone table readable?
console.log('\n== probe: project_milestones (anon read) ==');
const msRes = await fetch(
  `${url}/rest/v1/project_milestones?select=id,project_id,title,percentage,status&limit=5`,
  { headers: H },
);
console.log(`  HTTP ${msRes.status}`);
console.log('  ' + (await msRes.text()).slice(0, 600));