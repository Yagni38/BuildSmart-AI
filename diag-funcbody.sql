SELECT proname, pg_get_functiondef(p.oid) AS func_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_assigned_contractor','is_project_participant','is_project_customer','is_assigned_contractor_for_customer','is_admin')
ORDER BY p.proname;
