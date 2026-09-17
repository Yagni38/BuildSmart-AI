-- ============================================================
-- BuildSmart AI — Phase 11: Budget + Material Management (schema + RLS)
-- ============================================================
-- IDEMPOTENT migration — safe to run multiple times.
--
-- 1. Creates public.budget_items (estimated construction cost lines).
-- 2. Creates public.construction_materials (material take-off).
-- 3. RLS: participants can read; only the assigned contractor / project
--    owner can insert/update/delete. The original project.budget column
--    is NEVER written by these tables — they are independent ledgers.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) budget_items — estimated cost allocations per project
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name          text NOT NULL,          -- e.g. "Foundation", "Material Cost"
  category      text NOT NULL DEFAULT 'General',
  estimated     numeric NOT NULL DEFAULT 0, -- in Lakhs (INR)
  spent         numeric NOT NULL DEFAULT 0, -- in Lakhs (INR)
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_budget_items() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS budget_items_touch ON public.budget_items;
CREATE TRIGGER budget_items_touch
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_budget_items();

-- RLS: participants read; project owner + assigned contractor write.
DROP POLICY IF EXISTS "budget_items_select_participants" ON public.budget_items;
CREATE POLICY "budget_items_select_participants"
  ON public.budget_items FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "budget_items_insert_participants" ON public.budget_items;
CREATE POLICY "budget_items_insert_participants"
  ON public.budget_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "budget_items_update_participants" ON public.budget_items;
CREATE POLICY "budget_items_update_participants"
  ON public.budget_items FOR UPDATE
  TO authenticated
  USING (public.is_project_participant(project_id))
  WITH CHECK (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "budget_items_delete_participants" ON public.budget_items;
CREATE POLICY "budget_items_delete_participants"
  ON public.budget_items FOR DELETE
  TO authenticated
  USING (public.is_project_participant(project_id));

-- ------------------------------------------------------------
-- 2) construction_materials — material take-off per project
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.construction_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'structural', -- structural | finishing | services
  quantity      numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT 'units',      -- e.g. "kg", "nos", "sqft"
  estimated_cost numeric NOT NULL DEFAULT 0,         -- in INR
  actual_cost   numeric NOT NULL DEFAULT 0,          -- in INR
  supplier      text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_materials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_construction_materials() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS construction_materials_touch ON public.construction_materials;
CREATE TRIGGER construction_materials_touch
  BEFORE UPDATE ON public.construction_materials
  FOR EACH ROW EXECUTE FUNCTION public.touch_construction_materials();

-- RLS: participants read; project owner + assigned contractor write.
DROP POLICY IF EXISTS "construction_materials_select_participants" ON public.construction_materials;
CREATE POLICY "construction_materials_select_participants"
  ON public.construction_materials FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "construction_materials_insert_participants" ON public.construction_materials;
CREATE POLICY "construction_materials_insert_participants"
  ON public.construction_materials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "construction_materials_update_participants" ON public.construction_materials;
CREATE POLICY "construction_materials_update_participants"
  ON public.construction_materials FOR UPDATE
  TO authenticated
  USING (public.is_project_participant(project_id))
  WITH CHECK (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "construction_materials_delete_participants" ON public.construction_materials;
CREATE POLICY "construction_materials_delete_participants"
  ON public.construction_materials FOR DELETE
  TO authenticated
  USING (public.is_project_participant(project_id));

COMMIT;
