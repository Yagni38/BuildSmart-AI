SELECT pg_get_functiondef(p.oid) AS func_def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'is_admin';
