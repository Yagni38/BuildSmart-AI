SELECT conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c, pg_namespace n
WHERE c.contype = 'c'
  AND n.oid = c.connamespace
  AND n.nspname = 'public'
  AND c.conrelid = 'public.projects'::regclass
ORDER BY conname;