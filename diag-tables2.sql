SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('contractors', 'contractor_profiles', 'projects', 'profiles')
ORDER BY table_name;
