// READ-ONLY: verify each expected storage bucket exists and is listable.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const supabase = createClient(get('VITE_SUPABASE_URL'), get('VITE_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false },
});

for (const b of ['construction-updates', 'site-photos', 'contractor-resumes', 'ai-designs']) {
  const { data, error } = await supabase.storage.from(b).list('', { limit: 1 });
  console.log(
    `${b}: ${error ? 'ERROR -> ' + error.message : 'OK (bucket exists) files=' + (data?.length ?? 0)}`
  );
}
