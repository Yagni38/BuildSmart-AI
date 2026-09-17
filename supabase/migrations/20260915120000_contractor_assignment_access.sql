-- ===========================================================================
-- Contractor assignment access (real customer → contractor workflow)
-- ---------------------------------------------------------------------------
-- WHY: a customer could assign a contractor (projects.contractor_id was
-- written) but the assigned contractor's own authenticated session could not
-- read that project, so the Contractor Workspace always showed
-- "No assigned projects yet".
--
-- VERIFIED live evidence (authenticated role, JWT sub = the assigned
-- contractor):
--   auth.users.id = profiles.id = contractor_profiles.id = projects.contractor_id
--   is_assigned_contractor(<project>) -> true
--   SELECT * FROM projects                           -> 0 rows   (RLS filtered)
--   live projects policies = 3, all "auth.uid() = customer_id"
--   live project_milestones / site_logs = RLS enabled, 0 policies
--
-- This migration therefore ONLY:
--   1. adds the missing minimum contractor SELECT policy on projects,
--   2. adds participant-scoped policies for project_milestones / site_logs,
--   3. allows the app's existing CONTRACTOR_SELECTED project status value
--      (the live CHECK rejected it with 23514, so the customer's assignment
--      update failed silently).
--
-- It does NOT disable RLS, does NOT broaden access to other contractors,
-- does NOT add contractor_profiles.user_id, and does NOT invent columns.
-- Identity is resolved with the EXISTING relationship
-- (projects.contractor_id / auth.uid() / contractor_profiles.id|email).
-- Idempotent — safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Allow the application's CONTRACTOR_SELECTED status.
--    The live constraint was:
--      CHECK (status IN ('PLANNING','DESIGNING','CONTRACTOR_SEARCH',
--                        'IN_PROGRESS','COMPLETED','CANCELLED'))
--    The app has always used CONTRACTOR_SELECTED (types/project.ts, contractor
--    dashboard badges, selection banner), so the write failed with 23514.
--    This widens the allowed set — existing rows stay valid.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status = ANY (ARRAY[
    'PLANNING'::text,
    'DESIGNING'::text,
    'CONTRACTOR_SEARCH'::text,
    'CONTRACTOR_SELECTED'::text,
    'IN_PROGRESS'::text,
    'COMPLETED'::text,
    'CANCELLED'::text
  ]));

-- ---------------------------------------------------------------------------
-- 2) Helper: is the current user the customer who owns this project?
--    SECURITY DEFINER (like the existing is_assigned_contractor) so reading
--    projects inside the check cannot recurse through the projects policies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_customer(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND p.customer_id = auth.uid()
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3) projects: MINIMUM policy so an assigned contractor can read their own
--    assigned project. `is_assigned_contractor()` is the existing live helper
--    (verified to return true for the assigned contractor) and only ever
--    matches projects belonging to the caller.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_select_assigned_contractor ON public.projects;
CREATE POLICY projects_select_assigned_contractor
  ON public.projects FOR SELECT TO authenticated
  USING (
    contractor_id = auth.uid()                 -- direct identity (verified live)
    OR public.is_assigned_contractor(id)       -- legacy cp.id / email identity
  );

-- ---------------------------------------------------------------------------
-- 4) project_milestones: participants may READ, only the assigned contractor
--    may WRITE. (RLS is enabled on the live table with zero policies, so the
--    contractor could not see or update milestones at all.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS project_milestones_select_participants ON public.project_milestones;
CREATE POLICY project_milestones_select_participants
  ON public.project_milestones FOR SELECT TO authenticated
  USING (
    public.is_assigned_contractor(project_id)
    OR public.is_project_customer(project_id)
  );

DROP POLICY IF EXISTS project_milestones_insert_assigned ON public.project_milestones;
CREATE POLICY project_milestones_insert_assigned
  ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_contractor(project_id));

DROP POLICY IF EXISTS project_milestones_update_assigned ON public.project_milestones;
CREATE POLICY project_milestones_update_assigned
  ON public.project_milestones FOR UPDATE TO authenticated
  USING (public.is_assigned_contractor(project_id))
  WITH CHECK (public.is_assigned_contractor(project_id));

DROP POLICY IF EXISTS project_milestones_delete_assigned ON public.project_milestones;
CREATE POLICY project_milestones_delete_assigned
  ON public.project_milestones FOR DELETE TO authenticated
  USING (public.is_assigned_contractor(project_id));

-- ---------------------------------------------------------------------------
-- 5) site_logs (the existing site updates / progress photos table):
--    participants may READ, only the assigned contractor may post, and a log
--    row must be attributed to the caller.
--    NOTE: the legacy `project_updates` table does not exist live — site_logs
--    IS the updates/photos table (no duplicate table is created).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_logs_select_participants ON public.site_logs;
CREATE POLICY site_logs_select_participants
  ON public.site_logs FOR SELECT TO authenticated
  USING (
    public.is_assigned_contractor(project_id)
    OR public.is_project_customer(project_id)
  );

DROP POLICY IF EXISTS site_logs_insert_assigned ON public.site_logs;
CREATE POLICY site_logs_insert_assigned
  ON public.site_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_assigned_contractor(project_id)
    AND contractor_id = auth.uid()
  );