-- ============================================================
-- BuildSmart AI — Phase 6: projects schema for AI prompt data
-- ============================================================
-- The LIVE public.projects table was created by the pre-Phase-4 app and
-- uses the LEGACY schema (plot_length, plot_width, material_preference,
-- sustainability_preference, …). The Phase-4 migration file
-- (20260816130000_projects_customer_rls.sql) adds plot_size, requirements,
-- budget_min/max, construction_stage, project_type and contractor_id — but
-- it was never applied to the live database, so those columns are missing.
--
-- Phase 6 sends the customer's REAL project info to the Gemini image model,
-- so this additive, idempotent migration adds the missing columns exactly as
-- the Phase-4 migration defined them, and backfills plot_size for existing
-- rows that only have legacy plot_length × plot_width dimensions.
--
-- It does NOT touch the legacy status CHECK constraint (Phase-4 code already
-- handles the legacy status values) and does not modify any other table.
-- ============================================================

BEGIN;

-- Columns defined by the Phase-4 migration but missing from the live table.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type text NOT NULL DEFAULT 'NEW_CONSTRUCTION'
  CHECK (project_type IN ('NEW_CONSTRUCTION', 'RENOVATION', 'INTERIOR_DESIGN'));

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS plot_size           numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_min          numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS budget_max          numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS construction_stage  text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS requirements        text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contractor_id       uuid;

-- Backfill plot_size from legacy dimensions (feet × feet = sq.ft).
UPDATE public.projects
SET plot_size = plot_length * plot_width
WHERE plot_size IS NULL
  AND plot_length IS NOT NULL
  AND plot_width IS NOT NULL;

COMMIT;