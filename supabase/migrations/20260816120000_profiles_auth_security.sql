-- ============================================================
-- BuildSmart AI — public.profiles: schema baseline, RLS, trigger
-- ============================================================
-- WHY: the app was stuck on "Finishing setup..." because new users never
-- got a profile row (no trigger exists) and RLS is enabled with ZERO
-- policies (so even the user's own INSERT was denied: 42501).
--
-- This migration is IDEMPOTENT — safe to run multiple times.
-- Run it in the Supabase SQL Editor (or `supabase db push`).

BEGIN;

-- 1) Baseline table (no-op when it already exists).
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY,
  email      text NOT NULL,
  full_name  text,
  phone      text,
  role       text NOT NULL DEFAULT 'CUSTOMER'
             CHECK (role IN ('CUSTOMER', 'CONTRACTOR', 'ADMIN')),
  city       text,
  state      text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Fill in any columns a hand-created table may be missing.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'CUSTOMER'
  CHECK (role IN ('CUSTOMER', 'CONTRACTOR', 'ADMIN'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Ensure a primary key on id (needed for ON CONFLICT upserts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t     ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PK on profiles.id not created: %', SQLERRM;
END $$;

-- 4) Row Level Security — table-level RLS stays ENABLED; each role only
--    sees/writes ITS OWN row via auth.uid() = id. Profiles are NOT public.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP   POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP   POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP   POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 5) Trigger — create the profile row automatically when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_value text;
BEGIN
  role_value := COALESCE(NULLIF(upper(trim(NEW.raw_user_meta_data->>'role')), ''), 'CUSTOMER');
  IF role_value NOT IN ('CUSTOMER', 'CONTRACTOR', 'ADMIN') THEN
    role_value := 'CUSTOMER'; -- never guess ADMIN from public metadata
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    role_value,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) Backfill — create profile rows for auth.users that signed up BEFORE
--    the trigger existed (this includes the account the app is stuck on).
DO $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'phone', ''),
    CASE
      WHEN upper(trim(COALESCE(u.raw_user_meta_data->>'role', ''))) IN ('CUSTOMER', 'CONTRACTOR', 'ADMIN')
        THEN upper(trim(u.raw_user_meta_data->>'role'))
      ELSE 'CUSTOMER'
    END,
    COALESCE(u.created_at, now()),
    now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Profiles backfill skipped: %', SQLERRM;
END $$;

-- 7) Defensive grants (idempotent) — required only if the table is created
--    outside the Supabase dashboard (dashboard tables get these by default).
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

COMMIT;