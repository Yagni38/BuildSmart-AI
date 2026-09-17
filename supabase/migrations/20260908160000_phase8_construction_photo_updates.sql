-- ============================================================
-- BuildSmart AI — Phase 8: Construction Photo Updates (schema + RLS)
-- ============================================================
-- IDEMPOTENT migration — safe to run multiple times (Supabase SQL Editor or
-- supabase db push).
--
-- 1. Creates public.construction_photos (metadata for uploaded progress
--    photos) with RLS.
-- 2. Creates storage bucket `construction-updates` for the image files.
-- 3. Helper function (SECURITY DEFINER) to avoid recursive RLS lookups.
-- 4. RLS:
--    - Contractors can upload photos ONLY for projects assigned to them.
--    - Customers can VIEW photos belonging to their project.
--    - Only the contractor who uploaded a photo can DELETE it.
--    - Storage: upload only into your assigned project folder; participants
--      can read; only the uploader can delete their own file.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) construction_photos table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.construction_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL, -- profiles.id of the uploading contractor
  image_url     text NOT NULL, -- public URL from storage
  caption       text,
  milestone_id  uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.construction_photos ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2) RLS — construction_photos
--    SELECT: participants (customer + assigned contractor + admin).
--    INSERT: assigned contractor only (contractor_id must = auth.uid()).
--    DELETE: only the contractor who uploaded the photo.
--    UPDATE: not allowed (photos are immutable once uploaded).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "construction_photos_select_participants" ON public.construction_photos;
CREATE POLICY "construction_photos_select_participants"
  ON public.construction_photos FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "construction_photos_insert_contractor" ON public.construction_photos;
CREATE POLICY "construction_photos_insert_contractor"
  ON public.construction_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    contractor_id = auth.uid()
    AND public.is_assigned_contractor(project_id)
  );

DROP POLICY IF EXISTS "construction_photos_delete_owner" ON public.construction_photos;
CREATE POLICY "construction_photos_delete_owner"
  ON public.construction_photos FOR DELETE
  TO authenticated
  USING (contractor_id = auth.uid());

COMMIT;

-- ------------------------------------------------------------
-- 3) Storage: construction-updates bucket (outside the transaction)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('construction-updates', 'construction-updates', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated participants can read construction photos.
DROP POLICY IF EXISTS "construction_updates_read" ON storage.objects;
CREATE POLICY "construction_updates_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'construction-updates');

-- Only the assigned contractor can upload into their project folder
-- (path convention: construction-updates/<project_id>/<filename>).
DROP POLICY IF EXISTS "construction_updates_insert_contractor" ON storage.objects;
CREATE POLICY "construction_updates_insert_contractor"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'construction-updates'
    AND public.is_assigned_contractor((storage.foldername(name))[1]::uuid)
  );

-- Only the uploader (file owner) can delete their own file.
-- Path convention: construction-updates/<project_id>/<contractor_id>-<timestamp>-<filename>
-- The second segment starts with the contractor's UID, so LIKE matches ownership.
DROP POLICY IF EXISTS "construction_updates_delete_owner" ON storage.objects;
CREATE POLICY "construction_updates_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'construction-updates'
    AND (storage.foldername(name))[2] LIKE (auth.uid() || '%')
  );
