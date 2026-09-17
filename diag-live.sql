-- Inspect live helper functions (check for cp.user_id or email-based)
SELECT p.proname AS func_name,
       pg_get_functiondef(p.oid) AS func_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_assigned_contractor','is_project_participant','is_project_customer','is_assigned_contractor_for_customer','is_admin')
ORDER BY p.proname;

-- All projects policies on live DB
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'projects'
ORDER BY policyname;

-- Does a contractors table exist?
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'contractors';

-- Sample: projects with contractor_id set, their status
SELECT id, customer_id, contractor_id, status, created_at
FROM public.projects
WHERE contractor_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- contractor_profiles sample
SELECT id, full_name, email, verification_status
FROM public.contractor_profiles
ORDER BY created_at DESC
LIMIT 10;

-- profiles roles
SELECT role, COUNT(*) FROM public.profiles GROUP BY role;