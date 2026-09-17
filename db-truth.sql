-- TEMP ground-truth query (read-only). One statement: UNION ALL report.
SELECT 'CONSTRAINT projects' AS section, conname AS name,
       pg_get_constraintdef(oid) AS detail
  FROM pg_constraint
 WHERE conrelid = 'public.projects'::regclass AND contype = 'c'
UNION ALL
SELECT 'POLICY ' || tablename, policyname,
       'cmd=' || cmd || ' | roles=' || coalesce(array_to_string(roles, ','), 'public') ||
       ' | using=' || coalesce(qual, '-') || ' | check=' || coalesce(with_check, '-')
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('projects', 'project_milestones', 'site_logs', 'contractor_profiles', 'profiles')
UNION ALL
SELECT 'FUNCTION public', proname,
       'args=' || pg_get_function_arguments(p.oid)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND proname LIKE '%contractor%'
UNION ALL
SELECT 'COLUMN contractor_profiles', column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'contractor_profiles'
UNION ALL
SELECT 'COLUMN projects', column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'projects'
   AND column_name IN ('contractor_id', 'status', 'progress', 'selected_at', 'start_date')
ORDER BY section, name;