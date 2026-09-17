-- ============================================================
-- BuildSmart AI — Cleanup: Remove synthetic test/seed contractor accounts
-- ============================================================
-- WHY:
--   Development and E2E test scripts created many synthetic @example.com
--   contractor and customer accounts that pollute the Admin Dashboard.
--   Genuine contractors with gmail.com addresses are NEVER touched.
--   The ADMIN profile (admin-test) is preserved so admins can still log in.
--
-- WHAT:
--   1. Delete contractor_documents for test contractors
--   2. Delete construction_photos for test contractors
--   3. Delete site_logs for test contractors
--   4. Delete project_milestones for projects assigned to test contractors
--   5. Delete projects assigned to test contractors (both sides test)
--   6. Delete contractor_profiles WHERE email LIKE '%@example.com'
--   7. Delete profiles WHERE email LIKE '%@example.com' AND role != 'ADMIN'
--      (CASCADE cleans up: admin_actions, contractors, design_requests,
--       messages, notifications, projects (customer side), quotes, reviews)
--
-- DOES NOT touch:
--   - auth.users (reported for manual cleanup via Dashboard)
--   - any gmail.com profile or contractor_profile
--   - the admin-test @example.com profile (role = ADMIN preserved)
--   - any table schema, RLS policy, trigger, or function
--
-- IDEMPOTENT — safe to run multiple times.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1) Delete contractor_documents for test contractors
--    (contractor_id references profiles.id, no FK constraint)
-- ---------------------------------------------------------------
DELETE FROM public.contractor_documents
WHERE contractor_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN'
);

-- ---------------------------------------------------------------
-- 2) Delete construction_photos for test contractors
-- ---------------------------------------------------------------
DELETE FROM public.construction_photos
WHERE contractor_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN'
);

-- ---------------------------------------------------------------
-- 3) Delete site_logs for test contractors
-- ---------------------------------------------------------------
DELETE FROM public.site_logs
WHERE contractor_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN'
);

-- ---------------------------------------------------------------
-- 4) Delete project_milestones for projects assigned to test
--    contractors (project_id side — no FK cascade)
-- ---------------------------------------------------------------
DELETE FROM public.project_milestones
WHERE project_id IN (
  SELECT pr.id
  FROM public.projects pr
  JOIN public.profiles p ON p.id = pr.contractor_id
  WHERE p.email LIKE '%@example.com' AND p.role <> 'ADMIN'
);

-- ---------------------------------------------------------------
-- 5) Delete projects where BOTH contractor_id and customer_id
--    are test profiles.  Projects with a genuine customer are
--    NEVER deleted (even if a test contractor was assigned).
--    Projects with a test customer are CASCADE-deleted when the
--    customer profile is removed in step 7, but we clean the
--    contractor_id side here to avoid orphans.
-- ---------------------------------------------------------------
DELETE FROM public.projects
WHERE contractor_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN'
)
AND customer_id IN (
  SELECT id FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN'
);

-- ---------------------------------------------------------------
-- 6) Delete contractor_profiles for ALL @example.com addresses.
--    No table has a FK to contractor_profiles, so no CASCADE
--    concerns.  Genuine gmail.com contractors are untouched.
-- ---------------------------------------------------------------
DELETE FROM public.contractor_profiles
WHERE email LIKE '%@example.com';

-- ---------------------------------------------------------------
-- 7) Delete profiles for @example.com, EXCEPT role = 'ADMIN'.
--    CASCADE removes dependent rows in:
--      admin_actions (admin_id), contractors (profile_id),
--      design_requests (customer_id), messages (sender_id +
--      receiver_id), notifications (user_id), projects (customer_id),
--      quotes (customer_id), reviews (customer_id).
--    The admin-test @example.com profile (role = ADMIN) is preserved.
-- ---------------------------------------------------------------
DELETE FROM public.profiles
WHERE email LIKE '%@example.com'
  AND role <> 'ADMIN';

-- ---------------------------------------------------------------
-- 8) Report: remaining test data counts
-- ---------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.contractor_profiles WHERE email LIKE '%@example.com') AS remaining_test_contractor_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN') AS remaining_test_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE email LIKE '%@example.com' AND role = 'ADMIN') AS preserved_admin_profiles;

COMMIT;
