-- ============================================================
-- BuildSmart AI — Phase 2: Contractor Registration Schema & Storage
-- ============================================================
-- IDEMPOTENT migration for contractor registration:
-- 1. Extends public.profiles with company_name, description, resume_path, resume_url columns.
-- 2. Creates public.contractor_profiles table if needed for specialized queries.
-- 3. Enables RLS policies for profile & contractor updates.
-- 4. Creates storage bucket 'contractor-resumes' with RLS policies.
-- ============================================================

BEGIN;

-- 1) Extend public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_of_experience integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS project_types text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'PENDING'
  CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- 2) Create public.contractor_profiles table (for specialized contractor directory lookups)
CREATE TABLE IF NOT EXISTS public.contractor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  location text,
  skills text,
  years_of_experience integer,
  project_types text,
  description text,
  resume_path text,
  resume_url text,
  verification_status text NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on contractor_profiles
ALTER TABLE public.contractor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_profiles_select_public" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_select_public"
  ON public.contractor_profiles FOR SELECT
  USING (verification_status = 'APPROVED' OR auth.uid() = id);

DROP POLICY IF EXISTS "contractor_profiles_insert_own" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_insert_own"
  ON public.contractor_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "contractor_profiles_update_own" ON public.contractor_profiles;
CREATE POLICY "contractor_profiles_update_own"
  ON public.contractor_profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3) Storage bucket creation for contractor-resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contractor-resumes',
  'contractor-resumes',
  true,
  10485760, -- 10 MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- Storage Policies for contractor-resumes bucket
DROP POLICY IF EXISTS "contractor_resumes_insert_authenticated" ON storage.objects;
CREATE POLICY "contractor_resumes_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contractor-resumes');

DROP POLICY IF EXISTS "contractor_resumes_select_public" ON storage.objects;
CREATE POLICY "contractor_resumes_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contractor-resumes');

DROP POLICY IF EXISTS "contractor_resumes_update_own" ON storage.objects;
CREATE POLICY "contractor_resumes_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contractor-resumes' AND auth.uid() = owner);

DROP POLICY IF EXISTS "contractor_resumes_delete_own" ON storage.objects;
CREATE POLICY "contractor_resumes_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contractor-resumes' AND auth.uid() = owner);

COMMIT;
