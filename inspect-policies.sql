-- READ-ONLY inspection of the live contractor-side RLS surface.
select 'POLICY' as kind, tablename as obj, policyname as detail, cmd, coalesce(qual, with_check) as expr
  from pg_policies
 where schemaname = 'public'
   and tablename in ('projects','project_milestones','site_logs','project_updates')
union all
select 'FUNCTION', p.proname::text, '', '', ''
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('is_assigned_contractor','is_project_participant','current_user_role','is_admin')
union all
select 'RLS', c.relname::text, c.relrowsecurity::text, '', ''
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('projects','project_milestones','site_logs','project_updates')
order by kind, obj, detail;
