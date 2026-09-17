-- ============================================================
-- BuildSmart AI — Phase 3: Admin Contractor Verification RLS & Schema
-- ============================================================
-- IDEMPOTENT migration:
-- 1. Adds rejection_reason column to profiles and contractor_profiles tables.
-- 2. Restricts verification_status updates to authenticated ADMIN users via RLS.
-- 3. Enables ADMIN read/download RLS policies for contractor-resumes storage bucket.
-- ============================================================

BEGIN;

-- 1) Add rejection_reason column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.contractor_profiles ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2) RLS Policy: Only ADMIN users can update verification_status on profiles
-- (Non-admins can update their own profile fields except verification_status)
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

DROP POLICY IF EXISTS "profiles_admin_update_verification" ON public.profiles;
CREATE POLICY "profiles_admin_update_verification"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin()
  );

-- 3) RLS Policy: Only ADMIN users can update verification_status on contractor_profiles
DROP POLICY IF EXISTS "contractor_profiles_admin_update_verification" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_admin_update_verification"
  ON public.contractor_profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- 4) Storage RLS Policy: Only ADMIN or contractor owner can download resumes from contractor-resumes bucket
DROP POLICY IF EXISTS "contractor_resumes_admin_select" ON storage.objects;
CREATE POLICY "contractor_resumes_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contractor-resumes' AND (
      owner = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
      )
    )
  );

COMMIT;
