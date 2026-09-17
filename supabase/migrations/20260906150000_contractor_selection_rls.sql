-- ============================================================
-- BuildSmart AI — Phase 6: Contractor Selection Schema & RLS
-- ============================================================
-- IDEMPOTENT migration:
-- 1. Adds selected_at column to public.projects.
-- 2. Expands status constraint on public.projects to include CONTRACTOR_SELECTED.
-- 3. Enables SELECT RLS policy for assigned contractors.
-- ============================================================

BEGIN;

-- 1) Add selected_at column
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS selected_at timestamptz;

-- 2) Update status constraint on public.projects
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = relation.relnamespace
    WHERE ns.nspname = 'public'
      AND relation.relname = 'projects'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'PLANNING', 'CONTRACTOR_SELECTED', 'IN_PROGRESS', 'ACTIVE_BUILD', 'COMPLETED', 'CANCELLED'));

-- 3) RLS policy allowing assigned contractor to view their assigned projects
DROP POLICY IF EXISTS "projects_select_assigned_contractor" ON public.projects;
CREATE POLICY "projects_select_assigned_contractor"
  ON public.projects FOR SELECT
  USING (
    auth.uid() = contractor_id OR
    EXISTS (
      SELECT 1 FROM public.contractor_profiles cp 
      WHERE cp.id = auth.uid() AND cp.id::text = projects.contractor_id::text
    )
  );

COMMIT;
