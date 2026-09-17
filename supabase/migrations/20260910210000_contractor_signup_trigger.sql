-- ============================================================
-- BuildSmart AI — Future contractor signups: auto-create
-- contractor_profiles at the auth.users level
-- ============================================================
-- Closes the EXACT gap that emptied contractor_profiles:
-- ContractorRegistration.tsx calls authService.signUp() first; when Supabase
-- email confirmation is enabled the app returns early ("check your email")
-- BEFORE registerContractorProfile() can run — so only the profiles row was
-- created and the admin verification table stayed EMPTY.
--
-- This trigger (same SECURITY DEFINER pattern as the existing
-- handle_new_user → profiles trigger) guarantees that every future
-- auth.users row created with role = 'CONTRACTOR' ALSO gets a
-- contractor_profiles row:
--   • verification_status = 'PENDING' (admin can verify/reject it)
--   • full_name / phone / location / skills / experience (years) /
--     project_types taken from raw_user_meta_data — the REAL values the
--     contractor typed into the registration form (authService.signUp now
--     forwards them; nothing is invented)
--   • email is the duplicate-match key (contractor_profiles has no
--     owner-id column); ownership of a row is identified by its email
--   • id: contractor_profiles.id is NOT NULL (uuid), so it is carried
--     over EXPLICITLY from NEW.id (the auth user id) in this INSERT —
--     never omitted, never generated (fix for ERROR 23502: null id)
--   • INSERT only when no row for that email exists — duplicate-safe;
--     when the contractor later completes the form, the existing
--     registerContractorProfile flow UPDATES this same row with the resume.
--
-- Non-recursive: this function touches ONLY contractor_profiles.
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_contractor_verification_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta jsonb;
  v_role text;
  v_email text;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role := UPPER(TRIM(COALESCE(v_meta->>'role', '')));
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));

  IF v_role <> 'CONTRACTOR' OR v_email = '' THEN
    RETURN NEW; -- customers/admins are not verification subjects
  END IF;

  INSERT INTO public.contractor_profiles (
    id,
    full_name,
    email,
    phone,
    location,
    skills,
    experience_years,
    project_types,
    resume_url,
    verification_status
  )
  SELECT
    NEW.id,
    COALESCE(NULLIF(TRIM(v_meta->>'full_name'), ''), NEW.email),
    v_email,
    NULLIF(TRIM(COALESCE(v_meta->>'phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_meta->>'location', '')), ''),
    NULLIF(TRIM(COALESCE(v_meta->>'skills', '')), ''),
    CASE
      WHEN v_meta->>'experience_years' ~ '^\s*[0-9]+([.][0-9]+)?\s*$'
        THEN FLOOR((v_meta->>'experience_years')::numeric)::integer
      ELSE NULL
    END,
    NULLIF(TRIM(COALESCE(v_meta->>'project_types', '')), ''),
    NULL,            -- resume is uploaded after sign-in; the registration
                     -- flow updates this same row with the real resume_url
    'PENDING'
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.contractor_profiles cp
     WHERE LOWER(TRIM(cp.email)) = v_email
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_contractor_verification ON auth.users;

CREATE TRIGGER on_auth_user_created_contractor_verification
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_contractor_verification_row();
