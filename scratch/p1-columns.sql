-- Full column list for finance/material-relevant tables (live)
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects','project_milestones','quotes','quotations','expenses','project_expenses','material_rates','material_prices','materials','material_estimates','project_materials','material_requests','budget_items','cost_items','site_logs','project_budget','procurement_items')
ORDER BY table_name, ordinal_position;