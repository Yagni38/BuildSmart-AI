-- ============================================================
-- BuildSmart AI — Phase 6: REAL AI house visualization images
-- ============================================================
-- Reuses the existing public.ai_designs table (id, project_id,
-- customer_id, image_url, created_at …) and adds ONLY the columns
-- needed for real generated images:
--   prompt      text  — the exact prompt sent to the Gemini image model
--   image_path  text  — the Supabase Storage object path
--                        (ai-designs/{projectId}/{file}.png)
--   image_url          — added earlier by the Phase-5 enhanced schema;
--                        stores a short-lived signed URL at generation time.
--
-- Also creates the PRIVATE `ai-designs` Supabase Storage bucket and a
-- storage.objects RLS policy that lets ONLY the customer who owns the
-- project read (and sign URLs for) images under that project's folder.
--
-- IDEMPOTENT — safe to run multiple times. Does NOT modify or drop
-- any Phase-1–5 tables (profiles, projects, ai_materials).
-- ============================================================

BEGIN;

-- 1) Reuse the existing ai_designs table; add the Phase-6 columns only.
ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS prompt      text;

ALTER TABLE public.ai_designs
  ADD COLUMN IF NOT EXISTS image_path  text;

-- 2) Create the private storage bucket ai-designs (no-op when present).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-designs',
  'ai-designs',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3) storage.objects RLS — the signed-URL / download path is only usable
--    by the authenticated customer who OWNS the project whose UUID is the
--    first path segment (ai-designs/{projectId}/{file}).
--    Uploads are performed by the Edge Function with the service key,
--    which bypasses RLS, so no INSERT policy is needed here.
DROP POLICY IF EXISTS "ai_designs_storage_select_own" ON storage.objects;
CREATE POLICY "ai_designs_storage_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ai-designs'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.customer_id = auth.uid()
    )
  );

COMMIT;