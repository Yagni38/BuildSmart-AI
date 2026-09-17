-- PART 1/2 — helpers (no user_id) + status union. Idempotent.
BEGIN;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
CHECK (status = ANY (ARRAY['PLANNING'::text,'DESIGNING'::text,'CONTRACTOR_SEARCH'::text,'DRAFT'::text,'SUBMITTED'::text,'CONTRACTOR_SELECTED'::text,'IN_PROGRESS'::text,'ACTIVE_BUILD'::text,'COMPLETED'::text,'COMPLETE'::text,'CANCELLED'::text]));
CREATE OR REPLACE FUNCTION public.is_assigned_contractor(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ SELECT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p_project_id AND (pr.contractor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_profiles cp WHERE cp.id = pr.contractor_id AND NULLIF(TRIM(cp.email),'') IS NOT NULL AND LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(auth.email(),'')))))); $f$;
CREATE OR REPLACE FUNCTION public.is_project_customer(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.customer_id = auth.uid()); $f$;
GRANT EXECUTE ON FUNCTION public.is_assigned_contractor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_customer(uuid) TO authenticated;
COMMIT;
