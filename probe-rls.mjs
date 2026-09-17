// TEMP DIAGNOSTIC (deleted after use) — probe the live RLS helper functions.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const PASSWORD = 'ProbePass123!';
const stamp = Date.now();
const custEmail = `bsrls-c-${stamp}@example.com`;
const conEmail = `bsrls-k-${stamp}@example.com`;

const con = createClient(url, key);
const { data: su } = await con.auth.signUp({
  email: conEmail,
  password: PASSWORD,
  options: { data: { full_name: 'RLS Probe Contractor', role: 'CONTRACTOR' } },
});
const conId = su?.user?.id ?? null;

const cust = createClient(url, key);
const { data: cu } = await cust.auth.signUp({
  email: custEmail,
  password: PASSWORD,
  options: { data: { full_name: 'RLS Probe Customer', role: 'CUSTOMER' } },
});
const custId = cu?.user?.id ?? null;

console.log('== ids ==');
console.log('  contractor uid:', conId);
console.log('  customer uid  :', custId);

let projectId = null;

if (custId && conId) {
  const { data: proj, error: pErr } = await cust
    .from('projects')
    .insert({
      customer_id: custId,
      name: `RLS PROBE ${stamp}`,
      building_type: 'Villa',
      city: 'Bengaluru',
      state: 'Karnataka',
      status: 'PLANNING',
    })
    .select()
    .single();
  console.log('  insert project:', pErr ? `${pErr.code} ${pErr.message}` : `ok ${proj?.id}`);
  projectId = proj?.id ?? null;

  if (projectId) {
    const { data: upd, error: uErr } = await cust
      .from('projects')
      .update({ contractor_id: conId })
      .eq('id', projectId)
      .select()
      .single();
    console.log('  assign contractor:', uErr ? `${uErr.code} ${uErr.message}` : `ok saved=${upd?.contractor_id}`);

    // ---- RPC probing ----
    console.log('\n== RPC probes as the ASSIGNED CONTRACTOR ==');
    for (const fn of ['is_assigned_contractor', 'is_project_participant']) {
      for (const argName of ['project_id', 'p_project_id', '_project_id']) {
        const { data, error } = await con.rpc(fn, { [argName]: projectId });
        const status = error ? `${error.code ?? ''} ${error.message}` : `-> ${JSON.stringify(data)}`;
        console.log(`  ${fn}(${argName}) : ${status}`);
      }
    }

    console.log('\n== direct SELECT variants as contractor ==');
    const variants = {
      'eq contractor_id': con.from('projects').select('id,name,status,contractor_id').eq('contractor_id', conId),
      'select * no filter': con.from('projects').select('id,name,status,contractor_id').limit(5),
      'or contractor_id': con.from('projects').select('id,name,status,contractor_id').or(`contractor_id.eq.${conId}`),
    };
    for (const [label, q] of Object.entries(variants)) {
      const { data, error } = await q;
      console.log(`  ${label}: ${error ? `${error.code} ${error.message}` : `rows=${data?.length ?? 0}`}`);
    }

    console.log('\n== can contractor read the customer profiles row? ==');
    const { data: pr, error: prE } = await con.from('profiles').select('id,full_name,role').eq('id', custId);
    console.log(`  profiles read: ${prE ? `${prE.code} ${prE.message}` : `rows=${pr?.length ?? 0}`}`);

    console.log('\n== contractor own contractor_profiles row ==');
    const { data: cp, error: cpE } = await con
      .from('contractor_profiles')
      .select('id,email,verification_status')
      .eq('email', conEmail);
    console.log(`  cp read: ${cpE ? `${cpE.code} ${cpE.message}` : JSON.stringify(cp)}`);

    const { error: delErr } = await cust.from('projects').delete().eq('id', projectId);
    console.log('\n  cleanup:', delErr ? `${delErr.code} ${delErr.message}` : 'ok');
  }
}
console.log('== done ==');
