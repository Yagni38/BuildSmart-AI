-- ============================================================
-- BuildSmart AI — Phase 1: Customer Requirement Capture + Project Storage
-- ============================================================
-- Adds the two requirement-capture columns that the existing
-- public.projects table does not yet expose:
--   1. full_address  — full location/address (optional)
--   2. preferred_materials — customer material preferences (optional)
--
-- RLS is already ENABLED on public.projects with per-customer
-- policies (20260816130000_projects_customer_rls.sql); new columns
-- inherit the table-level RLS automatically. No policy changes needed.
--
-- IDEMPOTENT — safe to run multiple times (Supabase SQL Editor or
-- supabase db push).

BEGIN;

-- 1) full_address — full location/address if the customer provided one.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS full_address text;

-- 2) preferred_materials — customer-supplied material preferences.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS preferred_materials text;

-- 2) Defensive grants (idempotent, mirrors earlier migrations).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT SELECT ON TABLE public.projects TO anon;

COMMIT;
