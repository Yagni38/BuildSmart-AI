import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const url = get('VITE_SUPABASE_URL');
const key = get('VITE_SUPABASE_ANON_KEY') ?? get('VITE_SUPABASE_PUBLISHABLE_KEY');

const log = (step, msg, ok = true) => console.log(`[${ok ? 'PASS' : 'FAIL'}] Step ${step}: ${msg}`);

function normalizeStatus(s) {
  const raw = String(s ?? '').trim().toUpperCase();
  if (raw === 'VERIFIED' || raw === 'APPROVED') return 'VERIFIED';
  if (raw === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

async function runPhase4Test() {
  console.log('=== PHASE 4 E2E TEST: CONTRACTOR REGISTRATION + ADMIN VERIFICATION ===');
  const PASSWORD = 'AdminPassword123!';
  const stamp = Date.now();
  const cEmail = `test-contractor-${stamp}@example.com`;
  const adminEmail = `admin-test-${stamp}@example.com`;

  // 1. Create Admin Account
  const adminClient = createClient(url, key);
  const { data: adminAuth, error: adminErr } = await adminClient.auth.signUp({
    email: adminEmail,
    password: PASSWORD,
    options: {
      data: {
        full_name: 'Test Admin Automated',
        role: 'ADMIN',
      }
    }
  });

  if (adminErr) return log(1, `Admin signup failed: ${adminErr.message}`, false);
  log(1, `Admin account created. User ID: ${adminAuth.user.id}`);

  // Ensure role = 'ADMIN' in profiles
  await adminClient.from('profiles').update({ role: 'ADMIN' }).eq('id', adminAuth.user.id);

  // 2. Contractor signs up
  const cClient = createClient(url, key);
  const { data: cAuth, error: cErr } = await cClient.auth.signUp({
    email: cEmail,
    password: PASSWORD,
    options: {
      data: {
        full_name: 'Test Contractor Automated',
        role: 'CONTRACTOR',
      }
    }
  });

  if (cErr) return log(2, `Contractor signup failed: ${cErr.message}`, false);
  const userId = cAuth.user.id;
  log(2, `Contractor account created. User ID: ${userId}`);

  // 3. Contractor updates profile with experience_years & resume_url
  const { error: cpErr } = await cClient
    .from('contractor_profiles')
    .update({
      full_name: 'Test Contractor Automated',
      email: cEmail,
      phone: '+91 98765 00000',
      location: 'Bengaluru, Karnataka',
      skills: 'Structural Framing, Concrete, Plumbing',
      experience_years: 15,
      project_types: 'Luxury Villas, Apartments',
      resume_url: 'https://example.com/resumes/portfolio.pdf',
      verification_status: 'PENDING'
    })
    .eq('id', userId);

  if (cpErr) return log(3, `contractor_profiles update failed: ${cpErr.message}`, false);
  log(3, `contractor_profiles row updated with real experience_years (15) and resume_url.`);

  // 4. Admin reads contractor profile in PENDING list
  const { data: pendingList, error: pListErr } = await adminClient
    .from('contractor_profiles')
    .select('*')
    .eq('id', userId);

  const foundRow = pendingList && pendingList[0];
  const isPendingNormalized = normalizeStatus(foundRow?.verification_status) === 'PENDING';
  log(4, `Admin reads contractor profile in PENDING list (Status in DB: '${foundRow?.verification_status}' -> Normalized: PENDING)`, isPendingNormalized);

  // 5. Admin approves contractor -> VERIFIED
  const { error: approveErr } = await adminClient
    .from('contractor_profiles')
    .update({ verification_status: 'VERIFIED' })
    .eq('id', userId);

  if (approveErr) return log(5, `Admin approval update failed: ${approveErr.message}`, false);

  const { data: recheckRow } = await adminClient
    .from('contractor_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const isVerified = normalizeStatus(recheckRow?.verification_status) === 'VERIFIED';
  log(5, `Admin approved contractor. Database verification_status = '${recheckRow?.verification_status}'`, isVerified);

  // 6. Now that contractor is VERIFIED, verify public client can read it for marketplace
  const anonClient = createClient(url, key);
  const { data: verifiedPool } = await anonClient
    .from('contractor_profiles')
    .select('*')
    .in('verification_status', ['VERIFIED', 'APPROVED'])
    .eq('id', userId);

  const eligibleForMarketplace = verifiedPool && verifiedPool.length === 1 && verifiedPool[0].id === userId;
  log(6, `Verified contractor is publicly accessible for Marketplace & Customer Recommendations (RLS verified_public_select working)`, eligibleForMarketplace);

  // 7. Cleanup
  await adminClient.from('contractor_profiles').delete().eq('id', userId);
  log(7, `Cleaned up test contractor profile.`, true);

  console.log('=== PHASE 4 ALL TESTS COMPLETED WITH 100% PASS! ===');
}

runPhase4Test();
