SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('contractors', 'project_contractors')
ORDER BY table_name;