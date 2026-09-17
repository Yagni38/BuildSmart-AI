-- ============================================================
-- BuildSmart AI — Phase 4: Approved Contractor Marketplace RLS
-- ============================================================
-- IDEMPOTENT migration:
-- 1. Permits authenticated and public users to read APPROVED contractor profiles.
-- 2. Restricts non-approved contractor profile viewing to owner or admin.
-- ============================================================

BEGIN;

-- 1) Allow SELECT on public.profiles for APPROVED contractors or owner/ADMIN
DROP POLICY IF EXISTS "profiles_select_approved_contractors" ON public.profiles;
CREATE POLICY "profiles_select_approved_contractors"
  ON public.profiles FOR SELECT
  USING (
    (role = 'CONTRACTOR' AND verification_status = 'APPROVED') OR
    auth.uid() = id OR
    public.is_admin()
  );

-- 2) Allow SELECT on public.contractor_profiles for APPROVED contractors or owner/ADMIN
DROP POLICY IF EXISTS "contractor_profiles_select_public" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_select_public"
  ON public.contractor_profiles FOR SELECT
  USING (
    verification_status = 'APPROVED' OR 
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

COMMIT;
