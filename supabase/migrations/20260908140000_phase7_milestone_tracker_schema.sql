-- ============================================================
-- BuildSmart AI — Phase 7: Real Project Tracker (schema + RLS)
-- ============================================================
-- IDEMPOTENT — safe to run multiple times (Supabase SQL Editor or
-- supabase db push). Standalone: it (re)creates the RLS helper
-- functions and milestone policies so it does NOT depend on the
-- Phase 6 migration having run.
--
-- Adds the Phase-7 milestone fields required by the tracker:
--   progress           integer 0-100 (drives overall %)
--   start_date         date
--   expected_end_date  date
--   completed_date     timestamptz
--   updated_at         timestamptz (auto-bumped by trigger)
-- alongside the existing live columns (id, project_id, title,
-- description, status, due_date, completed_at, created_at).
--
-- RLS: participants (customer owner + assigned contractor + admin)
-- can READ milestones. ONLY the assigned contractor can
-- INSERT / UPDATE / DELETE them — customers can view but never
-- modify contractor milestone updates.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) project_milestones: add Phase-7 columns
-- ------------------------------------------------------------
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;
ALTER TABLE public.project_milestones DROP CONSTRAINT IF EXISTS milestones_progress_check;
ALTER TABLE public.project_milestones ADD CONSTRAINT milestones_progress_check
  CHECK (progress BETWEEN 0 AND 100);

ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS expected_end_date date;
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS completed_date timestamptz;
ALTER TABLE public.project_milestones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ------------------------------------------------------------
-- 2) updated_at auto-bump trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_milestones_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_milestones_set_updated_at ON public.project_milestones;
CREATE TRIGGER project_milestones_set_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.project_milestones_touch_updated_at();

-- ------------------------------------------------------------
-- 3) RLS helper functions (SECURITY DEFINER, avoids recursion)
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
          WHERE cp.id = auth.uid()
            AND cp.id = pr.contractor_id
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
          WHERE cp.id = auth.uid()
            AND cp.id = pr.contractor_id
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_assigned_contractor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_participant(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4) RLS policies — project_milestones
--    READ: participants. WRITE: assigned contractor only.
-- ------------------------------------------------------------
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "milestones_select_participants" ON public.project_milestones;
CREATE POLICY "milestones_select_participants"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "milestones_insert_assigned_contractor" ON public.project_milestones;
CREATE POLICY "milestones_insert_assigned_contractor"
  ON public.project_milestones FOR INSERT
  TO authenticated
  WITH CHECK (public.is_assigned_contractor(project_id));

DROP POLICY IF EXISTS "milestones_update_assigned_contractor" ON public.project_milestones;
CREATE POLICY "milestones_update_assigned_contractor"
  ON public.project_milestones FOR UPDATE
  TO authenticated
  USING (public.is_assigned_contractor(project_id))
  WITH CHECK (public.is_assigned_contractor(project_id));

DROP POLICY IF EXISTS "milestones_delete_assigned_contractor" ON public.project_milestones;
CREATE POLICY "milestones_delete_assigned_contractor"
  ON public.project_milestones FOR DELETE
  TO authenticated
  USING (public.is_assigned_contractor(project_id));

COMMIT;
