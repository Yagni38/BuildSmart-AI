-- ============================================================
-- BuildSmart AI — public.projects: Phase 4 customer CRUD + RLS
-- ============================================================
-- WHY: the projects table exists with RLS ENABLED but ZERO policies
-- (INSERT was denied with 42501), and several Phase-4 columns are missing
-- (project_type, plot_size, budget_min, budget_max, construction_stage,
-- requirements were verified absent via PostgREST 42703 probes).
--
-- IDEMPOTENT — safe to run multiple times. Run in the Supabase SQL Editor.

BEGIN;

-- 1) Baseline table (no-op when it already exists).
CREATE TABLE IF NOT EXISTS public.projects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL,
  contractor_id         uuid,
  name                  text NOT NULL,
  project_type          text NOT NULL DEFAULT 'NEW_CONSTRUCTION'
                        CHECK (project_type IN ('NEW_CONSTRUCTION', 'RENOVATION', 'INTERIOR_DESIGN')),
  building_type         text,
  city                  text,
  state                 text,
  plot_size             numeric,
  built_up_area         numeric,
  floors                integer,
  bedrooms              integer,
  bathrooms             integer,
  budget                numeric,
  budget_min            numeric,
  budget_max            numeric,
  construction_stage    text,
  description           text,
  requirements          text,
  soil_type             text,
  priority              text,
  design_style          text,
  status                text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 2) Fill in columns that a hand-created table may be missing
--    (verified absent: project_type, plot_size, budget_min, budget_max,
--     construction_stage, requirements).
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type       text NOT NULL DEFAULT 'NEW_CONSTRUCTION'
  CHECK (project_type IN ('NEW_CONSTRUCTION', 'RENOVATION', 'INTERIOR_DESIGN'));
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS plot_size          numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS built_up_area      numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS floors             integer;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS bedrooms           integer;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS bathrooms          integer;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget             numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_min         numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_max         numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS construction_stage text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS requirements       text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contractor_id      uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS soil_type          text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority           text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS design_style       text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name               text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS building_type      text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS city               text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS state              text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description        text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'DRAFT'
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

-- 2.5) Normalize the LEGACY status CHECK constraint.
--      A hand-created live table may constrain status to the OLD value list
--      (PLANNING / IN_PROGRESS / COMPLETED / CANCELLED, DEFAULT 'PLANNING'),
--      which rejects 'DRAFT' with 23514. Replace ANY status CHECK with the
--      Phase-4 list. Idempotent: the check is dropped and re-added each run.
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
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
-- 3) Ensure a primary key on id (needed by ON CONFLICT / stable refs).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t     ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'projects' AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PK on projects.id not created: %', SQLERRM;
END $$;

-- 4) Row Level Security — customers only their own projects, admins see all.
--    RLS stays ENABLED; projects are private per customer.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING (auth.uid() = customer_id);

-- Admin access (existing admin architecture is role-driven from profiles).
DROP POLICY IF EXISTS "projects_admin_all" ON public.projects;
CREATE POLICY "projects_admin_all"
  ON public.projects FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- 5) Foreign key to profiles (added only if the constraint is missing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.projects'::regclass AND contype = 'f'
      AND conname = 'projects_customer_id_fkey'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK projects.customer_id not added: %', SQLERRM;
END $$;

-- 6) Defensive grants (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT SELECT ON TABLE public.projects TO anon;

COMMIT;