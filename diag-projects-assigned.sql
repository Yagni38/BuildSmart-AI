SELECT id, customer_id, contractor_id, status, created_at
FROM public.projects
WHERE contractor_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;