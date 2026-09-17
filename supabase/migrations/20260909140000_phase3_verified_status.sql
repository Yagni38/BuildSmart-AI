-- ============================================================
-- BuildSmart AI — Phase 3: REAL Admin Contractor Verification
-- ============================================================
-- Makes "Verified" the canonical verified-pool status:
--   1. Extends the verification_status CHECK constraint on
--      public.profiles and public.contractor_profiles to allow
--      'VERIFIED' (legacy 'APPROVED' is kept so pre-existing rows
--      and old clients never fail).
--   2. Backfills existing 'APPROVED' rows to 'VERIFIED' so the
--      verified pool comes from the database with one clear label.
--   3. Updates the marketplace SELECT RLS policies so customers can
--      read contractors whose verification_status is VERIFIED
--      (or legacy APPROVED). PENDING / REJECTED stay invisible to
--      the marketplace and recommendations — enforced by the DB.
--
-- IDEMPOTENT — safe to run multiple times (Supabase SQL Editor or
-- `supabase db push`).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Rebuild the verification_status CHECK constraints to allow
--    'VERIFIED' alongside the legacy 'APPROVED'.
-- ------------------------------------------------------------

-- profiles
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = relation.relnamespace
    WHERE ns.nspname = 'public'
      AND relation.relname = 'profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%verification_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_verification_status_check
  CHECK (verification_status IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'));

-- contractor_profiles
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = relation.relnamespace
    WHERE ns.nspname = 'public'
      AND relation.relname = 'contractor_profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%verification_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.contractor_profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.contractor_profiles ADD CONSTRAINT contractor_profiles_verification_status_check
  CHECK (verification_status IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'));

-- ------------------------------------------------------------
-- 2) Backfill legacy 'APPROVED' → 'VERIFIED' so every row in the
--    verified pool carries the single canonical "Verified" status.
-- ------------------------------------------------------------
UPDATE public.profiles
  SET verification_status = 'VERIFIED', updated_at = now()
  WHERE verification_status = 'APPROVED';

-- Migration sessions have no auth.uid(). Suspend only the runtime
-- contractor authorization trigger for this data normalization statement.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.contractor_profiles'::regclass
      AND tgname = 'prevent_verification_self_approval_cp'
      AND tgenabled = 'O'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.contractor_profiles
      DISABLE TRIGGER prevent_verification_self_approval_cp;
  END IF;
END $$;

UPDATE public.contractor_profiles
  SET verification_status = 'VERIFIED'
  WHERE verification_status = 'APPROVED';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.contractor_profiles'::regclass
      AND tgname = 'prevent_verification_self_approval_cp'
      AND tgenabled = 'O'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.contractor_profiles
      ENABLE TRIGGER prevent_verification_self_approval_cp;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) RLS — allow customers to SELECT only VERIFIED (or legacy
--    APPROVED) contractor profiles. PENDING and REJECTED rows are
--    never returned to the marketplace/recommendations because the
--    RLS filter below rejects them at the database level.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_approved_contractors" ON public.profiles;
CREATE POLICY "profiles_select_approved_contractors"
  ON public.profiles FOR SELECT
  USING (
    (role = 'CONTRACTOR' AND verification_status IN ('VERIFIED', 'APPROVED')) OR
    auth.uid() = id OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "contractor_profiles_select_public" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_select_public"
  ON public.contractor_profiles FOR SELECT
  USING (
    verification_status IN ('VERIFIED', 'APPROVED') OR
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Defensive grants (idempotent, mirrors earlier migrations).
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.contractor_profiles TO authenticated;

COMMIT;