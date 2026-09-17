SELECT proname, pg_get_functiondef(p.oid) AS func_def
FROM pg_proc p, pg_namespace n
WHERE p.pronamespace = n.oid
  AND n.nspname = 'public'
  AND p.proname = 'is_admin'
ORDER BY p.proname;