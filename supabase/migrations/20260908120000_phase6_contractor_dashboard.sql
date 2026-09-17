-- ============================================================
-- BuildSmart AI — Phase 6: Real Contractor Dashboard (schema + RLS)
-- ============================================================
-- IDEMPOTENT migration — safe to run multiple times (Supabase SQL Editor or
-- supabase db push).
--
-- 1. Adds progress / start_date columns to public.projects.
-- 2. Creates public.project_updates (contractor progress / milestone / site /
--    image updates) with RLS.
-- 3. Helper functions (SECURITY DEFINER) to avoid recursive RLS lookups.
-- 4. RLS: contractors can only access projects assigned to them
--    (projects.contractor_id = auth.uid() or their contractor_profiles row).
--    Customers (project owners) can READ contractor updates but can NEVER
--    INSERT / UPDATE / DELETE them.
-- 5. Milestone + message policies so the dashboard can persist updates.
-- 6. Storage bucket `site-photos` for site image uploads.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) projects: progress + start_date
-- ------------------------------------------------------------
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_progress_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_progress_check
  CHECK (progress BETWEEN 0 AND 100);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date date;

-- ------------------------------------------------------------
-- 2) Helper functions (SECURITY DEFINER avoids recursive RLS)
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
-- 3) project_updates table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL, -- profiles.id of the contractor who posted
  update_type text NOT NULL DEFAULT 'SITE'
              CHECK (update_type IN ('PROGRESS', 'MILESTONE', 'SITE', 'IMAGE')),
  title       text,
  content     text,
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4) RLS — project_updates
--    READ: participants (customer owner + assigned contractor + admin).
--    WRITE: ONLY the assigned contractor. Customers can never modify
--    contractor-only updates.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "project_updates_select_participants" ON public.project_updates;
CREATE POLICY "project_updates_select_participants"
  ON public.project_updates FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "project_updates_insert_assigned_contractor" ON public.project_updates;
CREATE POLICY "project_updates_insert_assigned_contractor"
  ON public.project_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_assigned_contractor(project_id)
  );

DROP POLICY IF EXISTS "project_updates_update_assigned_contractor" ON public.project_updates;
CREATE POLICY "project_updates_update_assigned_contractor"
  ON public.project_updates FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() AND public.is_assigned_contractor(project_id))
  WITH CHECK (author_id = auth.uid() AND public.is_assigned_contractor(project_id));

DROP POLICY IF EXISTS "project_updates_delete_assigned_contractor" ON public.project_updates;
CREATE POLICY "project_updates_delete_assigned_contractor"
  ON public.project_updates FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() AND public.is_assigned_contractor(project_id));

-- ------------------------------------------------------------
-- 5) RLS — projects
--    SELECT for the assigned contractor (re-created idempotently in case it
--    is missing) + UPDATE so the contractor can push progress, status and
--    updated_at on THEIR OWN assigned projects only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_assigned_contractor" ON public.projects;
CREATE POLICY "projects_select_assigned_contractor"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_assigned_contractor(id));

DROP POLICY IF EXISTS "projects_update_assigned_contractor" ON public.projects;
CREATE POLICY "projects_update_assigned_contractor"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_assigned_contractor(id))
  WITH CHECK (public.is_assigned_contractor(id));

-- ------------------------------------------------------------
-- 6) RLS — project_milestones
--    READ: participants. WRITE: only the assigned contractor (customers can
--    view milestones but cannot modify contractor milestone updates).
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7) RLS — messages
--    READ/INSERT: participants (chat + supervisor logs). UPDATE/DELETE:
--    author only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id));

DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_participants"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_project_participant(project_id));

DROP POLICY IF EXISTS "messages_update_author" ON public.messages;
CREATE POLICY "messages_update_author"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_author" ON public.messages;
CREATE POLICY "messages_delete_author"
  ON public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- ------------------------------------------------------------
-- 7b) profiles — assigned contractor may read the CUSTOMER profile
--     of their assigned projects (needed to display the customer name).
--     SECURITY DEFINER helper: inner SELECT bypasses RLS and only matches
--     projects where auth.uid() is the assigned contractor.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_assigned_contractor_for_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.customer_id = p_customer_id
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

GRANT EXECUTE ON FUNCTION public.is_assigned_contractor_for_customer(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_project_customer_for_contractor" ON public.profiles;
CREATE POLICY "profiles_select_project_customer_for_contractor"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_assigned_contractor_for_customer(id));

COMMIT;

-- ------------------------------------------------------------
-- 8) Storage: site-photos bucket (outside the transaction — bucket inserts
--    cannot be rolled back reliably in some contexts).
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-photos', 'site-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated participants can read site photos.
DROP POLICY IF EXISTS "site_photos_read" ON storage.objects;
CREATE POLICY "site_photos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-photos');

-- Only the assigned contractor can upload into their project folder
-- (path convention: site-photos/<project_id>/<filename>).
DROP POLICY IF EXISTS "site_photos_insert_contractor" ON storage.objects;
CREATE POLICY "site_photos_insert_contractor"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-photos'
    AND public.is_assigned_contractor((storage.foldername(name))[1]::uuid)
  );

