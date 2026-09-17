BEGIN;

ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS experience_years integer;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS resume_url text;

-- Migration sessions have no auth.uid(). Suspend only the runtime
-- contractor authorization trigger for these normalization statements.
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
  WHERE UPPER(TRIM(COALESCE(verification_status, ''))) IN ('VERIFIED', 'APPROVED');

UPDATE public.contractor_profiles
  SET verification_status = 'PENDING'
  WHERE verification_status IS NULL
     OR UPPER(TRIM(verification_status)) NOT IN ('PENDING', 'VERIFIED', 'APPROVED', 'REJECTED');

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

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "contractor_profiles_select_public" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_admin_select_all" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_verified_select" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_owner_select" ON public.contractor_profiles;

CREATE POLICY "contractor_profiles_admin_select_all"
  ON public.contractor_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "contractor_profiles_verified_select"
  ON public.contractor_profiles FOR SELECT
  USING (verification_status IN ('VERIFIED', 'APPROVED'));

CREATE POLICY "contractor_profiles_owner_select"
  ON public.contractor_profiles FOR SELECT
  TO authenticated
  USING (email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()));

DROP POLICY IF EXISTS "contractor_profiles_insert_own" ON public.contractor_profiles;

CREATE POLICY "contractor_profiles_insert_authenticated"
  ON public.contractor_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contractor_profiles_update_own" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_admin_update_verification" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_owner_update" ON public.contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_admin_update_all" ON public.contractor_profiles;

CREATE POLICY "contractor_profiles_owner_update"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  WITH CHECK (email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()));

CREATE POLICY "contractor_profiles_admin_update_all"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON TABLE public.contractor_profiles TO authenticated;

COMMIT;
