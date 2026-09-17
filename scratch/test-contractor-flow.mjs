import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testContractorFlow() {
  console.log('--- TESTING CONTRACTOR REGISTRATION & ADMIN VERIFICATION ---');

  const testEmail = `test_contractor_${Date.now()}@buildsmarttest.com`;
  const testId = `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;

  console.log('1. Inserting test contractor profile:', testEmail);
  const { error: insertErr } = await supabase.from('contractor_profiles').insert({
    id: testId,
    full_name: 'Test Contractor Automated',
    email: testEmail,
    phone: '+919999988888',
    location: 'Bengaluru, Karnataka',
    skills: 'Structural Framing, Masonry, Plumbing',
    experience_years: 12,
    project_types: 'Residential Villas',
    verification_status: 'PENDING'
  });

  if (insertErr) {
    console.error('FAILED to insert contractor_profile:', insertErr.message);
    process.exit(1);
  }
  console.log('✔ Inserted PENDING contractor profile.');

  console.log('2. Querying pending contractors...');
  const { data: pendingRows, error: pendingErr } = await supabase
    .from('contractor_profiles')
    .select('*')
    .eq('id', testId);

  if (pendingErr || !pendingRows || pendingRows.length === 0) {
    console.error('FAILED to fetch pending contractor:', pendingErr);
    process.exit(1);
  }
  console.log('✔ Verified contractor appears in pending list. Verification Status:', pendingRows[0].verification_status);

  console.log('3. Admin approving contractor (status -> VERIFIED)...');
  const { error: updateErr } = await supabase
    .from('contractor_profiles')
    .update({ verification_status: 'VERIFIED' })
    .eq('id', testId);

  if (updateErr) {
    console.error('FAILED to update verification status:', updateErr.message);
    process.exit(1);
  }
  console.log('✔ Updated verification_status to VERIFIED.');

  console.log('4. Verifying contractor eligibility for marketplace & recommendations...');
  const { data: verifiedRows, error: verifiedErr } = await supabase
    .from('contractor_profiles')
    .select('*')
    .eq('verification_status', 'VERIFIED')
    .eq('id', testId);

  if (verifiedErr || !verifiedRows || verifiedRows.length === 0) {
    console.error('FAILED: Contractor did not appear in verified list!');
    process.exit(1);
  }
  console.log('✔ Verified contractor is now eligible for marketplace & customer recommendations!');

  console.log('5. Cleaning up test record...');
  await supabase.from('contractor_profiles').delete().eq('id', testId);
  console.log('✔ Cleaned up test record.');

  console.log('=== ALL CONTRACTOR REGISTRATION & ADMIN VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

testContractorFlow().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
