-- ============================================================
-- BuildSmart AI — Repair + Backfill: contractor_profiles (v2)
-- ============================================================
-- WHY v2: the first backfill attempt failed with
--   ERROR 42703: an owner-id column the live table no longer has
-- NOT because this file referenced that column, but because STALE objects
-- created by earlier migrations still live in the database and are
-- re-parsed whenever any statement touches public.contractor_profiles:
--   * policies that compare an owner-id column the live table no longer
--     has (created by the 090612 / 090613 / 091009 migrations), and
--   * the shared BEFORE UPDATE trigger function that reads row fields the
--     live table no longer has (it fires on EVERY update).
-- Postgres raises 42703 the moment those objects execute — before any of
-- the backfill logic runs. This migration therefore:
--   1. drops EVERY policy and trigger on contractor_profiles (catalog-
--      driven — it never parses old SQL text, so it cannot hit 42703),
--   2. recreates a schema-agnostic veto function (jsonb-based, zero hard
--      column references — safe on profiles AND contractor_profiles),
--   3. repairs the Phase-6 SECURITY DEFINER helpers the same way,
--   4. recreates a clean, minimal RLS set (admin read/update, owner by
--      EMAIL, verified rows publicly readable),
--   5. backfills existing contractors from public.profiles using REAL
--      data only, and backfills resumes from the storage bucket.
-- REVISION: the backfill INSERT now carries profiles.id explicitly into
--   contractor_profiles.id (NOT NULL uuid) — the previous run failed with
--   ERROR 23502: null value in column "id" of relation "contractor_profiles".
-- IDEMPOTENT — safe to run repeatedly. Run this file FIRST, then
-- 20260910210000_contractor_signup_trigger.sql.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Drop EVERY policy on contractor_profiles (catalog-driven).
--    Older migrations attached policies that reference a removed
--    owner-id column; any of them being re-parsed during INSERT/UPDATE
--    is what produced ERROR 42703 for the first backfill attempt.
-- ------------------------------------------------------------
DO $cleanup$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'contractor_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contractor_profiles', rec.policyname);
  END LOOP;
END
$cleanup$;

-- ------------------------------------------------------------
-- 2) Drop EVERY non-internal trigger on contractor_profiles.
--    The stale BEFORE UPDATE veto trigger (shared function) reads row
--    fields the live table no longer has and fires on every UPDATE.
--    It is recreated two steps below in a schema-agnostic form.
-- ------------------------------------------------------------
DO $cleanup$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT tgname
      FROM pg_trigger
     WHERE tgrelid = 'public.contractor_profiles'::regclass
       AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.contractor_profiles', rec.tgname);
  END LOOP;
END
$cleanup$;

-- ------------------------------------------------------------
-- 3) Repair public.is_admin() — case-insensitive role check.
--    SECURITY DEFINER reads profiles without going through RLS
--    (SET LOCAL row_security = off) to prevent infinite recursion
--    when policies or triggers call is_admin() during a profiles
--    query. LANGUAGE plpgsql is used instead of sql to keep the
--    optimizer from inlining the body into the calling policy.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(TRIM(COALESCE(p.role, ''))) = 'ADMIN'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ------------------------------------------------------------
-- 4) Schema-agnostic replacement of the shared veto function.
--    The Phase-4 original read raw owner/reason row fields —
--    columns the live table no longer has → 42703 on EVERY
--    contractor_profiles UPDATE (the exact error the first backfill
--    attempt hit). This version reads everything through to_jsonb()
--    with zero hard column references, so it is safe on BOTH tables
--    (profiles AND contractor_profiles) whatever columns they have.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_verification_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := to_jsonb(OLD);
  v_new_status text;
  v_old_status text;
  v_is_admin boolean;
BEGIN
  SELECT COALESCE(public.is_admin(), false) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN NEW; -- admins verify/reject freely
  END IF;

  -- SQL Editor / server-side contexts run without a user jwt; the veto
  -- targets authenticated end-users only (RLS still governs everything).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Role changes are admin-only (profiles key; absent elsewhere → no-op).
  IF TG_TABLE_NAME = 'profiles'
     AND v_new->>'role' IS DISTINCT FROM v_old->>'role' THEN
    RAISE EXCEPTION 'Only an admin can change roles.';
  END IF;

  -- rejection_reason is admin-only (jsonb read → no-op if column absent).
  IF v_new->>'rejection_reason' IS DISTINCT FROM v_old->>'rejection_reason' THEN
    RAISE EXCEPTION 'Only an admin can change the rejection reason.';
  END IF;

  v_new_status := UPPER(TRIM(COALESCE(v_new->>'verification_status', '')));
  v_old_status := UPPER(TRIM(COALESCE(v_old->>'verification_status', '')));

  -- No status column, or status unchanged → nothing to veto.
  IF v_new_status = '' OR v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  -- Ownership without any owner-id column:
  --   profiles            → row id IS the auth user id.
  --   contractor_profiles → the row's email identifies the owner.
  IF TG_TABLE_NAME = 'profiles' THEN
    IF v_new->>'id' IS DISTINCT FROM auth.uid()::text THEN
      RAISE EXCEPTION 'Not authorized to modify this profile.';
    END IF;
  ELSE
    IF LOWER(TRIM(COALESCE(v_new->>'email', '')))
       <> LOWER(TRIM(COALESCE((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), ''))) THEN
      RAISE EXCEPTION 'Not authorized to modify this contractor profile.';
    END IF;
  END IF;

  -- A contractor may reset their OWN application back to PENDING
  -- (resubmission); every other status transition requires an admin.
  IF v_new_status = 'PENDING' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only an admin can change verification status.';
END;
$func$;

-- Executable by any role: the function body itself enforces the admin-only
-- rule, and trigger execution must never fail on EXECUTE privileges.
GRANT EXECUTE ON FUNCTION public.prevent_verification_self_approval() TO PUBLIC;

-- Recreate the contractor veto trigger. The profiles trigger (if present)
-- already points at this same function and now runs the safe body.
DROP TRIGGER IF EXISTS prevent_verification_self_approval_cp ON public.contractor_profiles;
CREATE TRIGGER prevent_verification_self_approval_cp
  BEFORE UPDATE ON public.contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_verification_self_approval();

-- ------------------------------------------------------------
-- 5) Repair the Phase-6 SECURITY DEFINER helpers — they queried the
--    removed owner-id column (latent 42703 for any contractor or
--    customer project listing). Matching is now by EMAIL. projects.
--    contractor_id may hold either a contractor_profiles.id or an auth
--    user id; both are resolved without referencing an owner-id column.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_assigned_contractor(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = p_project_id
      AND (
        pr.contractor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contractor_profiles cp
          WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(
                  (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), '')))
            AND (
              cp.id = pr.contractor_id
              OR EXISTS (
                SELECT 1 FROM auth.users u2
                WHERE u2.id = pr.contractor_id
                  AND LOWER(TRIM(u2.email)) = LOWER(TRIM(cp.email))
              )
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_participant(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = p_project_id
      AND (
        pr.customer_id = auth.uid()
        OR pr.contractor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contractor_profiles cp
          WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(
                  (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), '')))
            AND (
              cp.id = pr.contractor_id
              OR EXISTS (
                SELECT 1 FROM auth.users u2
                WHERE u2.id = pr.contractor_id
                  AND LOWER(TRIM(u2.email)) = LOWER(TRIM(cp.email))
              )
            )
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND UPPER(TRIM(COALESCE(p.role, ''))) = 'ADMIN'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_contractor_for_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.customer_id = p_customer_id
      AND (
        pr.contractor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.contractor_profiles cp
          WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(
                  (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()), '')))
            AND (
              cp.id = pr.contractor_id
              OR EXISTS (
                SELECT 1 FROM auth.users u2
                WHERE u2.id = pr.contractor_id
                  AND LOWER(TRIM(u2.email)) = LOWER(TRIM(cp.email))
              )
            )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION
  public.is_assigned_contractor(uuid),
  public.is_project_participant(uuid),
  public.is_assigned_contractor_for_customer(uuid)
TO authenticated;

-- ------------------------------------------------------------
-- 6) Clean RLS policy set. RLS stays ENABLED (never disabled) and no
--    grants are touched. Ownership is matched by EMAIL because the live
--    table identifies rows by its own id + email only.
-- ------------------------------------------------------------
ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

-- Admins: full read + verification updates. is_admin() is SECURITY
-- DEFINER, so no recursive policy evaluation is possible.
CREATE POLICY "contractor_profiles_admin_select"
  ON public.contractor_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "contractor_profiles_admin_update"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Owner (email match): read / create / update their own application row.
-- The veto trigger recreated in step 4 still blocks any self-granted
-- status change — only a PENDING reset is allowed for owners.
CREATE POLICY "contractor_profiles_owner_select"
  ON public.contractor_profiles FOR SELECT
  TO authenticated
  USING (
    LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(
      (SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()), '')))
  );

CREATE POLICY "contractor_profiles_owner_insert"
  ON public.contractor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(
      (SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()), '')))
  );

CREATE POLICY "contractor_profiles_owner_update"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (
    LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(
      (SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()), '')))
  )
  WITH CHECK (
    LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(
      (SELECT pr.email FROM public.profiles pr WHERE pr.id = auth.uid()), '')))
  );

-- Marketplace / recommendations: everyone may read VERIFIED rows only —
-- PENDING and REJECTED rows stay invisible to non-admins.
CREATE POLICY "contractor_profiles_verified_public_select"
  ON public.contractor_profiles FOR SELECT
  TO anon, authenticated
  USING (UPPER(TRIM(COALESCE(verification_status, ''))) IN ('VERIFIED', 'APPROVED'));

-- ------------------------------------------------------------
-- 7) Backfill EXISTING contractors from public.profiles.
--    Identification: profiles.role = 'CONTRACTOR' (case-insensitive).
--    IDENTITY: contractor_profiles.id is NOT NULL (uuid), so it is
--    carried over EXPLICITLY from profiles.id (the auth user id) in
--    this INSERT — never omitted, never generated. profiles.id IS the
--    contractor's identity, so the backfilled row keeps the SAME id
--    as its source profile (fix for ERROR 23502: null value in "id").
--    Duplicate-safe: email is the only real key shared by both tables,
--    so a row is inserted ONLY when no row with the same lower-cased
--    email exists. Idempotent: re-running inserts nothing.
--    REAL data only: full_name / email / phone from profiles; location
--    from city + state; skills / experience / project types from the
--    signup auth metadata ONLY if present — otherwise NULL for the
--    admin to review. Nothing is invented.
-- ------------------------------------------------------------
INSERT INTO public.contractor_profiles (
  id,
  full_name, email, phone, location,
  skills, experience_years, project_types,
  resume_url, verification_status
)
SELECT
  p.id,
  p.full_name,
  LOWER(TRIM(p.email)),
  p.phone,
  COALESCE(
    NULLIF(TRIM(COALESCE(m.meta->>'location', '')), ''),
    CASE
      WHEN NULLIF(TRIM(COALESCE(p.city, '')), '')  IS NOT NULL
       AND NULLIF(TRIM(COALESCE(p.state, '')), '') IS NOT NULL
        THEN TRIM(p.city) || ', ' || TRIM(p.state)
      WHEN NULLIF(TRIM(COALESCE(p.city, '')), '')  IS NOT NULL
        THEN TRIM(p.city)
      ELSE NULLIF(TRIM(COALESCE(p.state, '')), '')
    END
  ),
  NULLIF(TRIM(COALESCE(m.meta->>'skills', '')), ''),
  CASE
    WHEN m.meta->>'experience_years' ~ '^\s*[0-9]+([.][0-9]+)?\s*$'
      THEN FLOOR((m.meta->>'experience_years')::numeric)::integer
    ELSE NULL
  END,
  NULLIF(TRIM(COALESCE(m.meta->>'project_types', '')), ''),
  NULL,
  'PENDING'
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT COALESCE(u.raw_user_meta_data, '{}'::jsonb) AS meta
    FROM auth.users u
   WHERE u.id = p.id
) m ON TRUE
WHERE UPPER(TRIM(COALESCE(p.role, ''))) = 'CONTRACTOR'
  AND p.email IS NOT NULL
  AND TRIM(p.email) <> ''
  AND NOT EXISTS (
    SELECT 1
      FROM public.contractor_profiles cp
     WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(p.email))
  );

-- ------------------------------------------------------------
-- 8) Normalize unknown / NULL statuses to PENDING so no existing
--    registration can be hidden by an unexpected status value.
--    VERIFIED / APPROVED / REJECTED rows are NEVER overwritten.
-- ------------------------------------------------------------
UPDATE public.contractor_profiles
   SET verification_status = 'PENDING'
 WHERE verification_status IS NULL
    OR UPPER(TRIM(verification_status))
         NOT IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED');

-- ------------------------------------------------------------
-- 9) Backfill resumes from REAL uploaded files.
--    Registration stores resumes in the `contractor-resumes` bucket at
--    `<auth-user-id>/<timestamp>_<filename>` (contractorService). profiles.id
--    IS that auth user id, so each contractor's newest uploaded object is
--    matched directly from storage — nothing is invented. The raw object
--    path is stored; the app's getSignedResumeUrl() signs it for the admin.
--    Only rows with no resume yet are touched; idempotent on re-run.
-- ------------------------------------------------------------
UPDATE public.contractor_profiles cp
   SET resume_url = newest.name
  FROM public.profiles p
  JOIN LATERAL (
    SELECT o.name
      FROM storage.objects o
     WHERE o.bucket_id = 'contractor-resumes'
       AND o.path_tokens[1] = p.id::text
     ORDER BY o.created_at DESC
     LIMIT 1
  ) newest ON TRUE
 WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(p.email))
   AND (cp.resume_url IS NULL OR TRIM(cp.resume_url) = '')
   AND newest.name IS NOT NULL;

-- ------------------------------------------------------------
-- 10) Verification report (visible in SQL Editor output).
-- ------------------------------------------------------------
DO $backfill_report$
DECLARE
  v_contractors_in_profiles integer;
  v_cp_rows integer;
  v_cp_pending integer;
  v_still_missing integer;
  v_roles text;
BEGIN
  SELECT COUNT(*) INTO v_contractors_in_profiles
    FROM public.profiles
   WHERE UPPER(TRIM(COALESCE(role, ''))) = 'CONTRACTOR'
     AND email IS NOT NULL AND TRIM(email) <> '';

  SELECT COUNT(*) INTO v_cp_rows FROM public.contractor_profiles;

  SELECT COUNT(*) INTO v_cp_pending
    FROM public.contractor_profiles
   WHERE UPPER(TRIM(COALESCE(verification_status, ''))) = 'PENDING';

  SELECT COUNT(*) INTO v_still_missing
    FROM public.profiles p
   WHERE UPPER(TRIM(COALESCE(p.role, ''))) = 'CONTRACTOR'
     AND p.email IS NOT NULL AND TRIM(p.email) <> ''
     AND NOT EXISTS (
       SELECT 1 FROM public.contractor_profiles cp
       WHERE LOWER(TRIM(cp.email)) = LOWER(TRIM(p.email))
     );

  SELECT COALESCE(
    (SELECT string_agg(role_label, ', ')
       FROM (
         SELECT '[' || COALESCE(role, '<NULL>') || ' x ' || COUNT(*)::text || ']' AS role_label
           FROM public.profiles
          GROUP BY role
          ORDER BY 1
       ) r),
  '') INTO v_roles;

  RAISE NOTICE 'BACKFILL REPORT — contractors in profiles: % | contractor_profiles rows: % | PENDING rows: % | still missing: %',
    v_contractors_in_profiles, v_cp_rows, v_cp_pending, v_still_missing;
  RAISE NOTICE 'BACKFILL REPORT — role values found in profiles: %', v_roles;
END
$backfill_report$;

COMMIT;

