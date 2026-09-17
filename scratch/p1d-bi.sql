-- budget_items row data (real data only)
SELECT project_id, count(*) AS items, sum(estimated) AS total_est, sum(spent) AS total_spent
FROM public.budget_items GROUP BY project_id;