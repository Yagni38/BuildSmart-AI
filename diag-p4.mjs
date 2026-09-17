// TEMPORARY Phase 4 diagnostic — probes the real Supabase projects schema.
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

// OpenAPI schema discovery for profiles/projects.
let gotSpec = false;
for (const accept of ['application/openapi+json', 'application/vnd.pgrst.object+json', 'application/json']) {
  try {
    const resp = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: accept },
    });
    const spec = await resp.json();
    if (spec?.definitions || spec?.components) {
      gotSpec = true;
      console.log('Got OpenAPI with Accept:', accept);
      for (const tbl of ['projects', 'profiles']) {
        const def = spec.definitions?.[tbl] ?? spec.components?.schemas?.[tbl];
        if (def) {
          console.log(`\n[${tbl}] schema:`);
          for (const [col, meta] of Object.entries(def.properties ?? {})) {
            console.log(`  ${col}: ${meta.format ?? meta.type}`);
          }
        } else {
          console.log(`\n[${tbl}] no schema in spec`);
        }
      }
      break;
    } else if (resp.status === 200) {
      console.log('OpenAPI unavailable. Root message:', JSON.stringify(spec).slice(0, 260));
    }
  } catch (err) {
    console.log('OpenAPI fetch failed:', err?.message ?? err);
  }
}
if (!gotSpec) console.log('NOTE: OpenAPI blocked — will rely on behavioral probes.');

// Behavioral probe with a REAL fresh session.
const email = `bs-p4-${Date.now()}@example.com`;
const { data: su, error: suErr } = await supabase.auth.signUp({
  email,
  password: 'P4Pass123!',
  options: { data: { full_name: 'P4 Tester', role: 'CUSTOMER', phone: null } },
});
console.log('\nsignUp:', suErr ? `ERROR ${suErr.message}` : `uid=${su.user.id} session=${!!su.session}`);
const uid = su?.user?.id;

if (su?.session && uid) {
  const p = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  console.log(
    'profile after signup:',
    p.error ? `ERR ${p.error.code}: ${p.error.message}` : p.data ? `OK id=${p.data.id} role=${p.data.role}` : 'MISSING ROW (no trigger?)'
  );

  const pr = await supabase.from('projects').select('*').limit(0);
  console.log(
    'projects table:',
    pr.error ? `ERR ${pr.error.code}: ${pr.error.message}` : `OK exists (RLS-filtered rows=${pr.data.length})`
  );
}
console.log('diag uid:', uid);