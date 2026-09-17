-- ===========================================================================
-- BuildSmart AI — Fix site_logs contractor updates end-to-end
-- ---------------------------------------------------------------------------
-- ROOT CAUSE (verified against the LIVE database):
--   public.site_logs has the live constraint
--     site_logs_contractor_id_fkey:
--       FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE CASCADE
--   The contractor registration pipeline creates profiles + contractor_profiles
--   rows (id == auth.uid()) but NOTHING ever created a public.contractors row,
--   and the app inserted auth.uid() as site_logs.contractor_id. Because
--   public.contractors had ZERO rows, every INSERT failed with:
--     23503 insert or update on table "site_logs" violates foreign key
--     constraint "site_logs_contractor_id_fkey"
--
-- FIX (idempotent, non-destructive, real data only):
--   1. public.get_current_contractor_id() — SECURITY DEFINER resolver that maps
--      the logged-in user (auth.uid()) to their public.contractors row via the
--      live FK contractors.profile_id = profiles.id = auth.uid(). (contractors
--      has RLS enabled with no policies, so the resolver must be SECURITY
--      DEFINER — same pattern as the existing is_assigned_contractor helper.)
--   2. Trigger on contractor_profiles AFTER INSERT that creates the matching
--      contractors row, so FUTURE registrations cannot regress. It does NOT
--      touch authentication; it only keeps the existing relationship complete.
--   3. Backfill: create the missing contractors rows for the EXISTING real
--      contractors, derived 1:1 from their real contractor_profiles data
--      (id = contractor_profiles.id = auth.uid(), the project-wide identity
--      convention). No invented values, no test records, no row updates.
--   4. site_logs INSERT policy: validate contractor_id as the caller's OWN
--      contractors row (contractor_id = get_current_contractor_id()) instead of
--      assuming it equals auth.uid(). Assignment security
--      (is_assigned_contractor(project_id)) is preserved unchanged.
--   5. site_logs SELECT policy: add the EXISTING admin authorization
--      (public.is_admin(), used by contractor_profiles_admin_select) so the
--      Admin Dashboard monitoring feed can read updates. Customer and assigned
--      contractor visibility is unchanged.
--   6. contractors SELECT policy for admins (mirrors
--      contractor_profiles_admin_select) so the admin feed can display the
--      contractor name.
--
-- No columns are invented or renamed; no RLS is disabled; no data is deleted.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) SECURITY DEFINER resolver: contractors.id of the logged-in contractor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_contractor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
    FROM public.contractors c
   WHERE c.profile_id = auth.uid()
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_contractor_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Auto-create the contractors row whenever a contractor_profiles row is
--    created (covers future registrations, including the row the signup
--    trigger inserts). Values come only from the real registration data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_contractors_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contractors (
    id, profile_id, company_name, owner_name,
    experience_years, verification_status
  )
  SELECT
    NEW.id,
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.full_name), ''),
      NEW.email
    ),
    NULLIF(TRIM(NEW.full_name), ''),
    NEW.experience_years,
    -- contractors.verification_status CHECK allows PENDING/APPROVED/REJECTED;
    -- contractor_profiles' VERIFIED maps to APPROVED (same mapping
    -- adminService.getContractorsByStatus uses for this table).
    CASE UPPER(TRIM(COALESCE(NEW.verification_status, '')))
      WHEN 'VERIFIED' THEN 'APPROVED'
      ELSE NEW.verification_status
    END
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contractors c WHERE c.profile_id = NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contractor_profiles_created ON public.contractor_profiles;
CREATE TRIGGER on_contractor_profiles_created
  AFTER INSERT ON public.contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_contractors_row();

-- ---------------------------------------------------------------------------
-- 3) Backfill: create missing contractors rows for EXISTING real contractors
--    from their real contractor_profiles data. Never touches existing rows.
-- ---------------------------------------------------------------------------
INSERT INTO public.contractors (
  id, profile_id, company_name, owner_name,
  experience_years, verification_status
)
SELECT
  cp.id,
  cp.id,
  COALESCE(
    NULLIF(TRIM(cp.full_name), ''),
    cp.email
  ),
  NULLIF(TRIM(cp.full_name), ''),
  cp.experience_years,
  -- contractors.verification_status CHECK allows PENDING/APPROVED/REJECTED;
  -- contractor_profiles' VERIFIED maps to APPROVED (same mapping
  -- adminService.getContractorsByStatus uses for this table).
  CASE cp.verification_status
    WHEN 'VERIFIED' THEN 'APPROVED'
    ELSE cp.verification_status
  END
FROM public.contractor_profiles cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.contractors c WHERE c.profile_id = cp.id
);

-- ---------------------------------------------------------------------------
-- 4) site_logs INSERT policy — validate the ACTUAL contractor identity
--    (the caller's own public.contractors row) while preserving the
--    assigned-project restriction unchanged.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_logs_insert_assigned ON public.site_logs;
CREATE POLICY site_logs_insert_assigned
  ON public.site_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_assigned_contractor(project_id)
    AND contractor_id = public.get_current_contractor_id()
  );

-- ---------------------------------------------------------------------------
-- 5) site_logs SELECT policy — unchanged participant visibility PLUS the
--    existing admin authorization (public.is_admin()).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_logs_select_participants ON public.site_logs;
CREATE POLICY site_logs_select_participants
  ON public.site_logs FOR SELECT
  TO authenticated
  USING (
    public.is_assigned_contractor(project_id)
    OR public.is_project_customer(project_id)
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 6) contractors SELECT policy for admins (mirrors
--    contractor_profiles_admin_select) so the admin feed can show the
--    contractor name.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS contractors_admin_select ON public.contractors;
CREATE POLICY contractors_admin_select
  ON public.contractors FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;