-- projects: remaining finance columns (live)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='projects'
  AND column_name IN ('budget','budget_min','budget_max','city','state','location','full_address','progress','status','customer_id','contractor_id');