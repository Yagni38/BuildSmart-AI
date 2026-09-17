import { notifySpendingSaved } from './projectFinancialService';
import { supabase } from '../lib/supabase';
import {
  estimateBudgetLines,
  estimateMaterialLines,
  MaterialEstimate,
} from '../lib/materialRates';
import {
  getBudgetItems,
  createBudgetItem,
  updateBudgetItem,
} from './budgetService';
import {
  getMaterials,
  createMaterial,
  updateMaterial,
} from './materialService';
import { updateProject } from './projectService';
import { BudgetItem, ConstructionMaterial, Project } from '../types/project';

/**
 * Phase 7 — estimate persistence.
 *
 * Saves the LATEST location-adjusted preliminary estimate against the project
 * using ONLY the existing tables/services:
 *  - public.construction_materials  (via materialService)
 *  - public.budget_items            (via budgetService)
 *  - public.projects.budget_min / budget_max (via projectService.updateProject)
 *
 * The original budget feature is preserved:
 *  - budget rows written here are tagged category='Preliminary Estimate';
 *    rows in any other category are NEVER touched or deleted.
 *  - `spent` on budget rows and `actual_cost`/`supplier` on material rows are
 *    carried over when the same line is re-estimated (name match), so nothing
 *    the user tracked by hand is destroyed.
 */

export const ESTIMATE_CATEGORY = 'Preliminary Estimate';

/**
 * Save the latest estimate as the project's material take-off and budget
 * breakdown. Update-in-place by name so tracked spend survives re-estimates.
 */
export async function saveEstimateToProject(
  projectId: string,
  estimate: MaterialEstimate
): Promise<{ materials: ConstructionMaterial[]; budgetItems: BudgetItem[] }> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    throw new Error('Please log in to save the estimate.');
  }

  // ---- 1) material take-off -------------------------------------------------
  const existingMaterials = await safeGetMaterials(projectId);
  const newMaterialLines = estimateMaterialLines(estimate);
  const existingByName = new Map(existingMaterials.map((m) => [m.name.toLowerCase(), m]));

  for (const line of newMaterialLines) {
    const match = existingByName.get(line.name.toLowerCase());
    if (match) {
      // Refresh estimate fields; keep actual_cost + supplier (user data).
      await updateMaterial(match.id, {
        category: line.category,
        quantity: line.quantity,
        unit: line.unit,
        estimated_cost: line.estimated_cost,
      });
    } else {
      await createMaterial({
        project_id: projectId,
        name: line.name,
        category: line.category,
        quantity: line.quantity,
        unit: line.unit,
        estimated_cost: line.estimated_cost,
        actual_cost: 0,
        supplier: null,
      });
    }
  }

  // Retain historical rows even when they are no longer part of the estimate.

  // ---- 2) budget breakdown (in Lakhs) --------------------------------------
  const existingBudget = await safeGetBudgetItems(projectId);
  const newBudgetLines = estimateBudgetLines(estimate);
  const budgetByName = new Map(existingBudget.map((b) => [b.name.toLowerCase(), b]));

  for (const line of newBudgetLines) {
    const match = budgetByName.get(line.name.toLowerCase());
    if (match) {
      // Refresh the estimate; keep `spent` (user data).
      await updateBudgetItem(match.id, { category: ESTIMATE_CATEGORY, estimated: line.estimated });
    } else {
      await createBudgetItem({
        project_id: projectId,
        name: line.name,
        category: ESTIMATE_CATEGORY,
        estimated: line.estimated,
        spent: 0,
        sort_order: newBudgetLines.indexOf(line),
      });
    }
  }

  // Re-estimation must never delete existing budget allocations or spending.

  const [materials, budgetItems] = await Promise.all([
    getMaterials(projectId),
    getBudgetItems(projectId),
  ]);
  notifySpendingSaved();
  return { materials, budgetItems };
}

/**
 * Apply the recalculated preliminary budget to the project row itself so the
 * dashboards show location-adjusted values. Writes budget_min / budget_max
 * (Phase-4 range columns) and the legacy `budget` point estimate via the
 * EXISTING updateProject() service — RLS permits the project owner only.
 */
export async function applyBudgetToProject(
  projectId: string,
  estimate: MaterialEstimate
): Promise<Project> {
  return updateProject(projectId, {
    budget_min: estimate.estimatedBudgetMin,
    budget_max: estimate.estimatedBudgetMax,
    budget: estimate.estimatedProjectBudget,
  });
}

async function safeGetMaterials(projectId: string): Promise<ConstructionMaterial[]> {
  try {
    return await getMaterials(projectId);
  } catch (err) {
    throw estimateStorageError(err);
  }
}

async function safeGetBudgetItems(projectId: string): Promise<BudgetItem[]> {
  try {
    return await getBudgetItems(projectId);
  } catch (err) {
    throw estimateStorageError(err);
  }
}

/**
 * Uniform, actionable error when the estimate tables are missing
 * (Phase-11 migration not applied to the live database yet).
 */
function estimateStorageError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/42P01|PGRST204|PGRST205|42703|Phase 11/i.test(message)) {
    return new Error(
      'Saving the estimate requires the budget/material tables. Please ask the ' +
        'administrator to run supabase/migrations/20260908200000_phase11_budget_material_management.sql ' +
        '(plus the Phase 6 migration that creates the RLS helper functions) in the Supabase SQL Editor.'
    );
  }
  return err instanceof Error ? err : new Error(message);
}
