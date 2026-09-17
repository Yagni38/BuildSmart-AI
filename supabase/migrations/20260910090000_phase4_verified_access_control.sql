-- ============================================================
-- BuildSmart AI - Phase 4: Verified Contractor Access Control
-- ============================================================
-- Closes the self-approval hole in pre-Phase-4 RLS:
--   * Old policies had NO WITH CHECK, so any contractor could
--     UPDATE their own verification_status to VERIFIED.
--   * New policies: non-admins may edit own profile fields but
--     can NEVER change verification_status/rejection_reason/role.
--   * SECURITY DEFINER trigger is the second lock: rejects any
--     non-admin verification change, while still allowing a
--     contractor resubmit to reset status to PENDING.
-- IDEMPOTENT - safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) Helper: true when caller is authenticated ADMIN.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2) profiles UPDATE policies with WITH CHECK guards.
DROP POLICY IF EXISTS "profiles_admin_update_verification" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;

CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND public.is_admin() IS NOT TRUE
  );

CREATE POLICY "profiles_admin_update_all"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- 3) contractor_profiles UPDATE policies with WITH CHECK guards.
DROP POLICY IF EXISTS "contractor_profiles_admin_update_verification" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_owner_update" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_admin_update_all" ON public.contractor_profiles;

CREATE POLICY "contractor_profiles_owner_update"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND verification_status IS NOT DISTINCT FROM (
      SELECT verification_status FROM public.contractor_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "contractor_profiles_admin_update_all"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) Trigger: database-level veto on self-approval.
CREATE OR REPLACE FUNCTION public.prevent_verification_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  caller_is_admin boolean;
  owner_id uuid;
BEGIN
  SELECT public.is_admin() INTO caller_is_admin;
  IF caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    owner_id := NEW.id;
  ELSE
    owner_id := NEW.id;
  END IF;

  IF owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to modify this contractor profile.';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF TG_TABLE_NAME = 'contractor_profiles'
      AND NEW.id = auth.uid()
       AND NEW.verification_status = 'PENDING' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Only an admin can change verification status.';
    END IF;
  END IF;

  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Only an admin can change the rejection reason.';
  END IF;

  IF TG_TABLE_NAME = 'profiles'
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only an admin can change roles.';
  END IF;

  RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.prevent_verification_self_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_verification_self_approval() TO authenticated;

DROP TRIGGER IF EXISTS prevent_verification_self_approval ON public.profiles;
CREATE TRIGGER prevent_verification_self_approval
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_verification_self_approval();

DROP TRIGGER IF EXISTS prevent_verification_self_approval_cp ON public.contractor_profiles;
CREATE TRIGGER prevent_verification_self_approval_cp
  BEFORE UPDATE ON public.contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_verification_self_approval();

COMMIT;
