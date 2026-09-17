import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') || get('VITE_SUPABASE_PUBLISHABLE_KEY');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();

async function query(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const json = await r.json();
  return Array.isArray(json) ? json : (json?.data ?? json?.rows ?? []);
}

const rows = await query(`SELECT proname, pg_get_functiondef(p.oid) AS def
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN ('is_assigned_contractor','is_admin')
ORDER BY proname;`);

for (const r of rows) {
  console.log('=== FUNCTION:', r.proname, '===');
  console.log(r.def);
  console.log();
}

const pols = await query(`SELECT policyname, cmd, roles, qual FROM pg_policies
WHERE schemaname='public' AND tablename='projects' ORDER BY policyname;`);

console.log('=== PROJECTS POLICIES ===');
for (const p of pols) {
  console.log(`${p.policyname} | ${p.cmd} | roles=${p.roles} | qual=${p.qual}`);
}
