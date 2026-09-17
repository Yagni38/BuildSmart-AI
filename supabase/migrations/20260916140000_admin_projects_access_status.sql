-- BuildSmart AI - restore admin project access and application statuses.
-- Idempotent: preserves RLS and does not alter contractor identity handling.

BEGIN;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Keep the existing project statuses and permit the two statuses used by the
-- assignment and active-project flows.
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'PLANNING',
    'DESIGNING',
    'CONTRACTOR_SEARCH',
    'DRAFT',
    'SUBMITTED',
    'CONTRACTOR_SELECTED',
    'IN_PROGRESS',
    'ACTIVE_BUILD',
    'COMPLETED',
    'COMPLETE',
    'CANCELLED'
  ));

-- Admin access is role-based through the existing public.profiles row.
DROP POLICY IF EXISTS projects_admin_all ON public.projects;
CREATE POLICY projects_admin_all
  ON public.projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ADMIN'
    )
  );

COMMIT;