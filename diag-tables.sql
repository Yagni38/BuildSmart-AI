SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('contractors', 'contractor_profiles', 'projects', 'profiles', 'auth.users')
ORDER BY table_name;

-- columns of contractor_profiles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contractor_profiles'
ORDER BY ordinal_position;