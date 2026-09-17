-- ============================================================
-- BuildSmart AI — Phase 2: persist the customer project timeline
-- ============================================================
-- The CreateProject form's "Expected Completion" date (Step 3:
-- Budget & Timeline) previously stayed local-only. This adds the
-- `timeline` column so it is persisted on public.projects.
--
-- Design preferences are NOT duplicated — the existing
-- `design_style` and `priority` columns already store them.
--
-- IDEMPOTENT — safe to run multiple times (Supabase SQL Editor or
-- `supabase db push`). RLS is already enabled on public.projects with
-- per-customer policies (20260816130000_projects_customer_rls.sql);
-- new columns inherit the table-level RLS automatically.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS timeline text;

-- Defensive grants (idempotent, mirrors the Phase-4 migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT SELECT ON TABLE public.projects TO anon;

COMMIT;
