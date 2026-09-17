-- ai_materials columns (live)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='ai_materials'
ORDER BY ordinal_position;