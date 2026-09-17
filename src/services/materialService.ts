import { getBudgetItems, updateBudgetItem } from './budgetService';
import { materialActualsInLakhs } from '../lib/projectFinancials';
import { notifySpendingSaved } from './projectFinancialService';
import { supabase } from '../lib/supabase';
import {
  ConstructionMaterial,
  CreateConstructionMaterialData,
  UpdateConstructionMaterialData,
} from '../types/project';

/**
 * Material service (Phase 11) — CRUD for public.construction_materials.
 *
 * RLS (mirrors the migration):
 *  - SELECT: project participants (customer + assigned contractor + admin).
 *  - INSERT / UPDATE / DELETE: participants only.
 */

const TABLE = 'construction_materials';

function formatDbError(action: string, error: { message: string; code?: string }): string {
  const code = error.code ? ` [${error.code}]` : '';
  return `${action}: ${error.message}${code}`;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Please log in to manage materials.');
  }
  return data.user.id;
}

/** Fetch all materials using a verified column for stable ordering. */
export async function getMaterials(projectId: string): Promise<ConstructionMaterial[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true });

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST204' || error.code === '42703') {
      throw new Error(
        'Materials require the Phase 11 migration. Please run ' +
          'supabase/migrations/20260908200000_phase11_budget_material_management.sql ' +
          'in the Supabase SQL Editor.'
      );
    }
    console.error('[materialService] getMaterials failed:', error.message);
    throw new Error(formatDbError('Failed to load materials', error));
  }

  return (data as unknown as ConstructionMaterial[]) ?? [];
}

/** Create a new material. */
export async function createMaterial(item: CreateConstructionMaterialData): Promise<ConstructionMaterial> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      project_id: item.project_id,
      name: item.name,
      category: item.category ?? 'structural',
      quantity: item.quantity ?? 0,
      unit: item.unit ?? 'units',
      estimated_cost: item.estimated_cost ?? 0,
      actual_cost: item.actual_cost ?? 0,
      supplier: item.supplier ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[materialService] createMaterial failed:', error.message);
    throw new Error(formatDbError('Failed to create material', error));
  }

  return data as unknown as ConstructionMaterial;
}

/** Update an existing material. */
export async function updateMaterial(
  id: string,
  updates: UpdateConstructionMaterialData
): Promise<ConstructionMaterial> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.quantity !== undefined && { quantity: updates.quantity }),
      ...(updates.unit !== undefined && { unit: updates.unit }),
      ...(updates.estimated_cost !== undefined && { estimated_cost: updates.estimated_cost }),
      ...(updates.actual_cost !== undefined && { actual_cost: updates.actual_cost }),
      ...(updates.supplier !== undefined && { supplier: updates.supplier }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[materialService] updateMaterial failed:', error.message);
    throw new Error(formatDbError('Failed to update material', error));
  }

  return data as unknown as ConstructionMaterial;
}

/** Explicit recorded spending only; estimate/progress updates never call this. */
export async function recordMaterialActual(projectId: string, materialId: string, amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a non-negative actual cost in INR.');
  const items = await getBudgetItems(projectId);
  const materialItems = items.filter(item => item.name.trim().toLowerCase() === 'material cost');
  if (materialItems.length !== 1) {
    throw new Error('Recording requires exactly one existing Material Cost budget item for this project. No data was changed.');
  }
  const materials = await getMaterials(projectId);
  if (!materials.some(item => item.id === materialId)) throw new Error('Material does not belong to this project.');
  const savedMaterial = await updateMaterial(materialId, { actual_cost: Math.round(amount * 100) / 100 });
  try {
    if (Number(savedMaterial.actual_cost) !== Math.round(amount * 100) / 100) {
      throw new Error('Material actual read-back did not match the requested amount.');
    }
    // Replace from saved totals, never increment with the entered amount.
    const savedMaterials = await getMaterials(projectId);
    const spent = materialActualsInLakhs(savedMaterials);
    await updateBudgetItem(materialItems[0].id, { spent });
    const savedItems = await getBudgetItems(projectId);
    const recorded = Number(savedItems.find(item => item.id === materialItems[0].id)?.spent);
    if (!Number.isFinite(recorded) || Math.abs(recorded - spent) > 0.0000001) {
      throw new Error('Budget spending read-back did not match.');
    }
    notifySpendingSaved();
    return { materials: savedMaterials, budgetItems: savedItems };
  } catch (error) {
    notifySpendingSaved();
    throw new Error(`Material actual was saved, but budget synchronization failed. Retry Save actual cost with the same total to reconcile safely. ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Delete a material. */
export async function deleteMaterial(id: string): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    console.error('[materialService] deleteMaterial failed:', error.message);
    throw new Error(formatDbError('Failed to delete material', error));
  }
}

/**
 * Bulk replace all materials for a project (used when seeding defaults).
 */
export async function replaceMaterials(
  projectId: string,
  items: Omit<CreateConstructionMaterialData, 'project_id'>[]
): Promise<ConstructionMaterial[]> {
  await getAuthenticatedUserId();

  const { error: delError } = await supabase
    .from(TABLE)
    .delete()
    .eq('project_id', projectId);

  if (delError) {
    console.error('[materialService] replaceMaterials delete failed:', delError.message);
    throw new Error(formatDbError('Failed to reset materials', delError));
  }

  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      items.map((item) => ({
        project_id: projectId,
        name: item.name,
        category: item.category ?? 'structural',
        quantity: item.quantity ?? 0,
        unit: item.unit ?? 'units',
        estimated_cost: item.estimated_cost ?? 0,
        actual_cost: item.actual_cost ?? 0,
        supplier: item.supplier ?? null,
      }))
    )
    .select();

  if (error) {
    console.error('[materialService] replaceMaterials insert failed:', error.message);
    throw new Error(formatDbError('Failed to save materials', error));
  }

  return (data as unknown as ConstructionMaterial[]) ?? [];
}
