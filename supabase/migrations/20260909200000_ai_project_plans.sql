-- ============================================================
-- BuildSmart AI — Phase 2: AI Project Plan storage
-- ============================================================
-- Stores the comprehensive AI-generated project plan (budget,
-- timeline, design) produced by the generate-ai-project-plan
-- Edge Function. One row per generation per project.
--
-- RLS: customers only see their own plans. The Edge Function
-- (SECURITY DEFINER) handles the insert on their behalf.
-- IDEMPOTENT — safe to run multiple times.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_project_plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id             uuid NOT NULL,

  -- Budget (preliminary planning estimate, not a quotation)
  budget_estimate_min     numeric,
  budget_estimate_max     numeric,
  budget_currency         text NOT NULL DEFAULT 'INR',
  budget_notes            text,
  budget_breakdown        jsonb,            -- [{ category, item, estimatedCost, notes }]

  -- Timeline (stage-wise construction schedule)
  timeline_notes          text,
  timeline_stages         jsonb,            -- [{ stage, durationDays, description, startDate, endDate }]

  -- Design concept
  design_concept          text,
  design_style            text,
  design_prompt           text,             -- exact prompt sent to the AI model

  -- Source project snapshot (what the AI was given)
  source_project_snapshot  jsonb,

  -- Metadata
  ai_model                text,
  ai_raw_response         text,             -- raw text/JSON from the model
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookups by project.
CREATE INDEX IF NOT EXISTS idx_ai_project_plans_project ON public.ai_project_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_project_plans_customer ON public.ai_project_plans(customer_id);

-- RLS: customers only see their own AI project plans.
ALTER TABLE public.ai_project_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_project_plans_select_own" ON public.ai_project_plans;
CREATE POLICY "ai_project_plans_select_own"
  ON public.ai_project_plans FOR SELECT
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "ai_project_plans_insert_own" ON public.ai_project_plans;
CREATE POLICY "ai_project_plans_insert_own"
  ON public.ai_project_plans FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "ai_project_plans_update_own" ON public.ai_project_plans;
CREATE POLICY "ai_project_plans_update_own"
  ON public.ai_project_plans FOR UPDATE
  USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "ai_project_plans_delete_own" ON public.ai_project_plans;
CREATE POLICY "ai_project_plans_delete_own"
  ON public.ai_project_plans FOR DELETE
  USING (auth.uid() = customer_id);

-- Admin access.
DROP POLICY IF EXISTS "ai_project_plans_admin_all" ON public.ai_project_plans;
CREATE POLICY "ai_project_plans_admin_all"
  ON public.ai_project_plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- Grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_project_plans TO authenticated;

COMMIT;
