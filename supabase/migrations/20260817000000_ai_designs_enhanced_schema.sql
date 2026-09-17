-- ============================================================
-- BuildSmart AI — Phase 5: ai_designs table enhancements
-- ============================================================
-- Adds columns required by the Phase 5 structured AI design output
-- that are missing from the Phase-4 ai_designs table:
--   color_palette, lighting, construction_recommendations,
--   estimated_budget_notes, image_url
--
-- The existing columns (design_title, design_summary, style,
-- layout_recommendation, exterior_recommendation,
-- interior_recommendation, sustainability_recommendation,
-- estimated_cost_min, estimated_cost_max, ai_response) are reused
-- for the corresponding structured fields.
--
-- IDEMPOTENT — safe to run multiple times. Does NOT modify or drop
-- any Phase-4 tables (projects, profiles, ai_materials).
-- ============================================================

BEGIN;

-- Add columns that the Phase-4 ai_designs table does not yet have.
-- Each ADD COLUMN IF NOT EXISTS is a no-op when the column already exists,
-- so this migration is safe to re-run.
ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS color_palette              text;

ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS lighting                   text;

ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS construction_recommendations text;

ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS estimated_budget_notes     text;

ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS image_url                  text;

COMMIT;
