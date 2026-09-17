import { supabase } from '../lib/supabase';
import {
  BudgetItem,
  CreateBudgetItemData,
  UpdateBudgetItemData,
} from '../types/project';

/**
 * Budget service (Phase 11) — CRUD for public.budget_items.
 * Independent ledger: never writes to the original project.budget column.
 *
 * RLS (mirrors the migration):
 *  - SELECT: project participants (customer + assigned contractor + admin).
 *  - INSERT / UPDATE / DELETE: participants only.
 */

const TABLE = 'budget_items';

function formatDbError(action: string, error: { message: string; code?: string }): string {
  const code = error.code ? ` [${error.code}]` : '';
  return `${action}: ${error.message}${code}`;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Please log in to manage the budget.');
  }
  return data.user.id;
}

/** Fetch all budget items for a project, ordered by sort_order. */
export async function getBudgetItems(projectId: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204' || error.code === '42703') {
      throw new Error(
        'Budget items require the Phase 11 migration. Please run ' +
          'supabase/migrations/20260908200000_phase11_budget_material_management.sql ' +
          'in the Supabase SQL Editor.'
      );
    }
    console.error('[budgetService] getBudgetItems failed:', error.message);
    throw new Error(formatDbError('Failed to load budget items', error));
  }

  return (data as unknown as BudgetItem[]) ?? [];
}

/** Create a new budget item. */
export async function createBudgetItem(item: CreateBudgetItemData): Promise<BudgetItem> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      project_id: item.project_id,
      name: item.name,
      category: item.category ?? 'General',
      estimated: item.estimated ?? 0,
      spent: item.spent ?? 0,
      sort_order: item.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[budgetService] createBudgetItem failed:', error.message);
    throw new Error(formatDbError('Failed to create budget item', error));
  }

  return data as unknown as BudgetItem;
}

/** Update an existing budget item. */
export async function updateBudgetItem(
  id: string,
  updates: UpdateBudgetItemData
): Promise<BudgetItem> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.estimated !== undefined && { estimated: updates.estimated }),
      ...(updates.spent !== undefined && { spent: updates.spent }),
      ...(updates.sort_order !== undefined && { sort_order: updates.sort_order }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[budgetService] updateBudgetItem failed:', error.message);
    throw new Error(formatDbError('Failed to update budget item', error));
  }

  return data as unknown as BudgetItem;
}

/** Delete a budget item. */
export async function deleteBudgetItem(id: string): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    console.error('[budgetService] deleteBudgetItem failed:', error.message);
    throw new Error(formatDbError('Failed to delete budget item', error));
  }
}

/**
 * Bulk replace all budget items for a project (used when seeding defaults
 * from the AI estimator). Deletes existing rows and inserts the new set.
 * Wrapped in a best-effort approach — if the delete succeeds but insert
 * fails, the user sees the error.
 */
export async function replaceBudgetItems(
  projectId: string,
  items: Omit<CreateBudgetItemData, 'project_id'>[]
): Promise<BudgetItem[]> {
  await getAuthenticatedUserId();

  // Delete existing rows first.
  const { error: delError } = await supabase
    .from(TABLE)
    .delete()
    .eq('project_id', projectId);

  if (delError) {
    console.error('[budgetService] replaceBudgetItems delete failed:', delError.message);
    throw new Error(formatDbError('Failed to reset budget items', delError));
  }

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      items.map((item, idx) => ({
        project_id: projectId,
        name: item.name,
        category: item.category ?? 'General',
        estimated: item.estimated ?? 0,
        spent: item.spent ?? 0,
        sort_order: item.sort_order ?? idx,
      }))
    )
    .select();

  if (error) {
    console.error('[budgetService] replaceBudgetItems insert failed:', error.message);
    throw new Error(formatDbError('Failed to save budget items', error));
  }

  return (data as unknown as BudgetItem[]) ?? [];
}
