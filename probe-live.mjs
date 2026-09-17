// TEMP DIAGNOSTIC (deleted after use) — enumerates live tables/columns via the
// PostgREST OpenAPI root.
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const spec = await res.json();
const defs = spec.definitions ?? {};
const tables = Object.keys(defs).sort();

console.log(`== live tables (${tables.length}) ==`);
console.log(tables.join(', '));

for (const t of ['project_milestones', 'site_logs', 'project_updates', 'messages', 'construction_photos']) {
  console.log(`\n== ${t} ==`);
  console.log(defs[t] ? Object.keys(defs[t].properties ?? {}).join(', ') : 'TABLE DOES NOT EXIST');
}