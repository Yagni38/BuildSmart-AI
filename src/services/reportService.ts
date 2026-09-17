import { supabase } from '../lib/supabase';
import { Project, BudgetItem, ConstructionMaterial, ConstructionPhoto } from '../types/project';
import { ProjectMilestone } from '../types';
import { ProjectUpdate } from '../types/project';

/**
 * Report service (Phase 13) — assembles a project summary from real Supabase
 * data. Used by ReportPage to render a printable project report.
 *
 * Financial values come from:
 * - project.budget / budget_min / budget_max (project row)
 * - budget_items (estimated vs spent per category, Phase 11 migration)
 * - construction_materials (material take-off, Phase 11 migration)
 *
 * If the Phase 11 migration has not been applied, budget/material sections
 * gracefully fall back to project-level budget columns only.
 */

export interface ContractorInfo {
  fullName: string | null;
  companyName: string | null;
}

export interface ContractorPerformance {
  milestoneCompletionRate: number; // 0–100
  totalMilestones: number;
  completedMilestones: number;
  updateCount: number;
  projectProgress: number;
  averageProgressPerMilestone: number;
  lastUpdateDate: string | null;
}

export interface BudgetSummary {
  totalBudget: number | null;
  materialCostEstimate: number; // Sum of construction_materials estimated_cost
  totalSpent: number; // Sum of budget_items spent
  remaining: number | null; // totalBudget - totalSpent (can be negative)
  isOverBudget: boolean;
  budgetItems: BudgetItem[];
  materials: ConstructionMaterial[];
}

export interface ProjectReport {
  project: Project;
  contractor: ContractorInfo | null;
  contractorPerformance: ContractorPerformance | null;
  milestones: ProjectMilestone[];
  updates: ProjectUpdate[];
  photos: ConstructionPhoto[];
  latestActivity: string | null;
  budgetSummary: BudgetSummary;
  currentStage: string | null;
}

/**
 * Fetch the full project report: project row + contractor info + milestones +
 * updates + photos + latest activity timestamp.
 */
export async function getProjectReport(projectId: string): Promise<ProjectReport> {
  const { data: project, error: projectError } = await supabase
    .from('projects').select('*').eq('id', projectId).maybeSingle();

  if (projectError) throw new Error(`Failed to load project: ${projectError.message}`);
  if (!project) throw new Error('Project not found or you do not have access to it.');

  let contractor: ContractorInfo | null = null;
  if (project.contractor_id) {
    const { data: cp } = await supabase
      .from('contractor_profiles')
      .select('full_name, email')
      .eq('id', project.contractor_id)
      .maybeSingle();
    if (cp) {
      contractor = {
        fullName: cp.full_name,
        companyName: cp.full_name ? `${cp.full_name} Builders` : 'Verified Contractor',
      };
    }
  }

  const { data: milestones } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');

  const { data: rawSiteLogs } = await supabase
    .from('site_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const updates: ProjectUpdate[] = (rawSiteLogs ?? []).map((row: any) => ({
    id: row.id,
    project_id: row.project_id,
    author_id: row.contractor_id ?? '',
    update_type: row.image_url ? 'IMAGE' : 'SITE',
    title: null,
    content: row.description ?? null,
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    updated_at: row.created_at,
  }));

  const photos: ConstructionPhoto[] = (rawSiteLogs ?? [])
    .filter((row: any) => Boolean(row.image_url))
    .map((row: any) => ({
      id: row.id,
      project_id: row.project_id,
      contractor_id: row.contractor_id ?? null,
      milestone_id: row.milestone_id ?? null,
      image_url: row.image_url,
      caption: row.description ?? null,
      created_at: row.created_at,
    }));

  const budgetSummary = await buildBudgetSummary(projectId, project);
  const contractorPerformance = buildContractorPerformance(
    milestones as ProjectMilestone[] | null, updates as ProjectUpdate[] | null, project.progress);
  const currentStage = determineCurrentStage(project.construction_stage, milestones as ProjectMilestone[] | null);
  const latestActivity = getLatestActivityTimestamp(updates ?? [], photos ?? [], milestones ?? []);

  return {
    project: project as Project, contractor, contractorPerformance,
    milestones: (milestones as ProjectMilestone[]) ?? [],
    updates: (updates as ProjectUpdate[]) ?? [],
    photos: (photos as ConstructionPhoto[]) ?? [],
    latestActivity, budgetSummary, currentStage,
  };
}

async function buildBudgetSummary(
  projectId: string,
  project: { budget?: number | null; budget_min?: number | null; budget_max?: number | null }
): Promise<BudgetSummary> {
  let totalBudget: number | null = null;

  if (project.budget != null) totalBudget = project.budget;
  if (project.budget_min != null && (totalBudget == null || project.budget_min > totalBudget)) {
    totalBudget = project.budget_min;
  }
  if (project.budget_max != null && (totalBudget == null || project.budget_max > totalBudget)) {
    totalBudget = project.budget_max;
  }

  let budgetItems: BudgetItem[] = [];
  let totalSpent = 0;

  try {
    const { data: items } = await supabase
      .from('budget_items')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');

    if (items) {
      budgetItems = items as unknown as BudgetItem[];
      totalSpent = budgetItems.reduce((sum, item) => sum + Number(item.spent ?? 0), 0);
    }
  } catch {
    // Phase 11 migration not applied
  }

  let materials: ConstructionMaterial[] = [];
  let materialCostEstimate = 0;

  try {
    const { data: mats } = await supabase
      .from('construction_materials')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order');

    if (mats) {
      materials = mats as unknown as ConstructionMaterial[];
      materialCostEstimate = materials.reduce((sum, m) => sum + Number(m.estimated_cost ?? 0), 0);
    }
  } catch {
    // Phase 11 migration not applied
  }

  const remaining = totalBudget != null ? totalBudget - totalSpent : null;

  return {
    totalBudget,
    materialCostEstimate,
    totalSpent,
    remaining,
    isOverBudget: remaining != null && remaining < 0,
    budgetItems,
    materials,
  };
}

function buildContractorPerformance(
  milestones: ProjectMilestone[] | null, updates: ProjectUpdate[] | null, projectProgress: number | null
): ContractorPerformance | null {
  const ms = milestones ?? [];
  const up = updates ?? [];
  if (ms.length === 0 && up.length === 0) return null;
  const completed = ms.filter((m) => (m.status ?? '').toUpperCase() === 'COMPLETED' || Number(m.progress ?? 0) >= 100).length;
  const total = ms.length;
  return {
    milestoneCompletionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalMilestones: total, completedMilestones: completed,
    updateCount: up.length, projectProgress: projectProgress ?? 0,
    averageProgressPerMilestone: total > 0 ? Math.round(ms.reduce((s, m) => s + Number(m.progress ?? 0), 0) / total) : 0,
    lastUpdateDate: up.length > 0 ? up[0].created_at : null,
  };
}

function determineCurrentStage(projectStage: string | null | undefined, milestones: ProjectMilestone[] | null): string | null {
  if (projectStage) return projectStage;
  const ms = milestones ?? [];
  if (ms.length === 0) return null;
  const active = ms.find((m) => (m.status ?? '').toUpperCase() === 'IN_PROGRESS' || (Number(m.progress ?? 0) > 0 && Number(m.progress ?? 0) < 100));
  if (active) return active.title;
  const completed = ms.filter((m) => (m.status ?? '').toUpperCase() === 'COMPLETED' || Number(m.progress ?? 0) >= 100).pop();
  if (completed) return `${completed.title} (Completed)`;
  const pending = ms.find((m) => (m.status ?? '').toUpperCase() === 'PENDING' && Number(m.progress ?? 0) === 0);
  if (pending) return `${pending.title} (Pending)`;
  return ms[0]?.title ?? null;
}

function getLatestActivityTimestamp(
  updates: ProjectUpdate[],
  photos: ConstructionPhoto[],
  milestones: ProjectMilestone[]
): string | null {
  const candidates: string[] = [];
  if (updates.length > 0) candidates.push(updates[0].created_at);
  if (photos.length > 0) candidates.push(photos[0].created_at);
  for (const m of milestones) {
    if (m.updated_at) candidates.push(m.updated_at);
    else candidates.push(m.created_at);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return candidates[0];
}

/**
 * Format a budget value in INR for display.
 */
export function formatBudget(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Format an ISO timestamp for the report view.
 */
export function formatReportDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format an ISO timestamp with time for the report view.
 */
export function formatReportDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
