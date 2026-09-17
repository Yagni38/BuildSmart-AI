-- PART 2/2 — remaining helpers + policies. Idempotent, append-only part.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_project_participant(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ SELECT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = p_project_id AND (pr.customer_id = auth.uid() OR pr.contractor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_profiles cp WHERE cp.id = pr.contractor_id AND NULLIF(TRIM(cp.email),'') IS NOT NULL AND LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(auth.email(),'')))) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'))); $f$;
CREATE OR REPLACE FUNCTION public.is_assigned_contractor_for_customer(p_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ SELECT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.customer_id = p_customer_id AND (pr.contractor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.contractor_profiles cp WHERE cp.id = pr.contractor_id AND NULLIF(TRIM(cp.email),'') IS NOT NULL AND LOWER(TRIM(cp.email)) = LOWER(TRIM(COALESCE(auth.email(),'')))))); $f$;
GRANT EXECUTE ON FUNCTION public.is_project_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_contractor_for_customer(uuid) TO authenticated;
DROP POLICY IF EXISTS projects_select_assigned_contractor ON public.projects;
CREATE POLICY projects_select_assigned_contractor ON public.projects FOR SELECT TO authenticated USING (contractor_id = auth.uid() OR public.is_assigned_contractor(id));
DROP POLICY IF EXISTS projects_admin_all ON public.projects;
CREATE POLICY projects_admin_all ON public.projects FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
COMMIT;
