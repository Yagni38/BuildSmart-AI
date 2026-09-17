-- projects: remaining finance columns (live)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='projects'
  AND column_name IN ('budget','budget_min','budget_max','city','state','location','full_address','progress','status','customer_id','contractor_id');

-- construction_materials columns (live)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='construction_materials'
ORDER BY ordinal_position;

-- ai_materials columns (live)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='ai_materials'
ORDER BY ordinal_position;

-- budget_items row data (real data only, counts by project)
SELECT project_id, count(*) AS items, sum(estimated) AS total_est, sum(spent) AS total_spent
FROM public.budget_items GROUP BY project_id;

-- construction_materials row data
SELECT count(*) AS rows FROM public.construction_materials;

-- ai_materials row data
SELECT count(*) AS rows FROM public.ai_materials;