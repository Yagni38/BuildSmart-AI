-- Check for contractor-related related tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%contractor%' OR tablename LIKE '%document%' OR tablename LIKE '%site%') ORDER BY tablename;
