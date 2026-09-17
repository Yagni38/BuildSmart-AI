import { supabase } from '../lib/supabase';
import { ProjectMilestone } from '../types';

/**
 * Milestone service — CRUD for the `project_milestones` table.
 *
 * PHASE 7 (project tracker):
 *   The canonical tracker fields are title, description, status,
 *   progress, start_date, expected_end_date, completed_date, updated_at
 *   (added by supabase/migrations/20260908140000_phase7_milestone_tracker_schema.sql).
 *   The legacy live columns due_date / completed_at are still written for
 *   backward compatibility with pre-migration databases.
 *
 * RLS (same migration): customers can READ milestones of projects they own;
 * only the ASSIGNED contractor can INSERT / UPDATE / DELETE them.
 */

// Base columns that are guaranteed present in the live table.
// NOTE: the live public.project_milestones column that stores completion is
// `percentage` (NOT `progress`). `percentage` is therefore part of the base
// list and the service normalizes it onto the app-level `progress` field.
const BASE_MILESTONE_COLUMNS = [
  'id',
  'project_id',
  'title',
  'description',
  'percentage',
  'status',
  'due_date',
  'completed_at',
  'created_at',
] as const;

// Phase-7 columns — added by the migration; probed like projectService's
// PHASE4_COLUMNS so the app works before AND after the migration is applied.
const PHASE7_MILESTONE_COLUMNS = [
  'progress',
  'start_date',
  'expected_end_date',
  'completed_date',
  'updated_at',
] as const;

let milestoneColumnProbePromise: Promise<Set<string>> | null = null;

function resolveMilestoneColumns(): Promise<Set<string>> {
  if (!milestoneColumnProbePromise) {
    milestoneColumnProbePromise = (async () => {
      const found = new Set<string>(BASE_MILESTONE_COLUMNS);
      await Promise.all(
        PHASE7_MILESTONE_COLUMNS.map(async (col) => {
          const { error } = await supabase
            .from('project_milestones')
            .select(col)
            .limit(0);
          if (!error) found.add(col);
        })
      );
      return found;
    })();
  }
  return milestoneColumnProbePromise;
}

/** The comma-separated select list with the columns that actually exist. */
async function milestoneSelectColumns(): Promise<string> {
  const cols = await resolveMilestoneColumns();
  return [...cols].join(',');
}

/**
 * Normalize a raw milestone row onto the app-level ProjectMilestone shape.
 * The live table stores completion in `percentage`; older/newer databases may
 * use `progress`. Both are merged so every consumer sees `progress`.
 */
function normalizeMilestoneRow(row: any): ProjectMilestone {
  const progressValue = row.progress ?? row.percentage;
  return {
    ...row,
    progress: progressValue == null ? null : Number(progressValue),
  } as unknown as ProjectMilestone;
}

/**
 * Map a raw Supabase error to a user-friendly message.
 */
function friendlyMilestoneError(action: string, message: string): string {
  if (message.includes('row-level security')) {
    return (
      `${action}: the database is missing a permission (RLS policy) for the ` +
      'project_milestones table, so this operation is not allowed yet. ' +
      'Please ask the administrator to add the milestone RLS policies.'
    );
  }
  return `${action}: ${message}`;
}


/**
 * Fetch all milestones for a specific project, ordered by start date
 * (then expected end date, then created_at).
 */
export async function getMilestonesByProject(projectId: string): Promise<ProjectMilestone[]> {
  const cols = await resolveMilestoneColumns();
  const select = [...cols].join(',');
  const orderCol = cols.has('start_date') ? 'start_date' : 'created_at';
  const orderCol2 = cols.has('expected_end_date') ? 'expected_end_date' : null;

  let query = supabase
    .from('project_milestones')
    .select(select)
    .eq('project_id', projectId)
    .order(orderCol, { ascending: true, nullsFirst: false });

  if (orderCol2) {
    query = query.order(orderCol2, { ascending: true, nullsFirst: false });
  }
  query = query.order('created_at', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('[milestoneService] getMilestonesByProject failed:', error.message);
    throw new Error(friendlyMilestoneError('Failed to load milestones', error.message));
  }

  let list = ((data ?? []) as any[]).map(normalizeMilestoneRow);
  if (list.length === 0) {
    await initializeProjectStages(projectId);
    const { data: reData } = await query;
    list = ((reData ?? []) as any[]).map(normalizeMilestoneRow);
  }

  return list;
}

/**
 * Fetch a single milestone by its UUID.
 */
export async function getMilestoneById(milestoneId: string): Promise<ProjectMilestone | null> {
  const select = await milestoneSelectColumns();
  const { data, error } = await supabase
    .from('project_milestones')
    .select(select)
    .eq('id', milestoneId)
    .maybeSingle();

  if (error) {
    console.error('[milestoneService] getMilestoneById failed:', error.message);
    throw new Error(friendlyMilestoneError('Failed to fetch milestone', error.message));
  }

  return data ? normalizeMilestoneRow(data) : null;
}

/**
 * Create a new milestone associated with a project. Sends Phase-7 fields
 * (progress / start_date / expected_end_date / completed_date) when they
 * exist in the live database; otherwise writes the live `percentage` column.
 * The legacy due_date/completed_at are kept.
 */
export async function createMilestone(
  milestone: Pick<ProjectMilestone, 'project_id' | 'title'> &
    Partial<Omit<ProjectMilestone, 'id' | 'created_at' | 'project_id' | 'title'>>
): Promise<ProjectMilestone> {
  const cols = await resolveMilestoneColumns();
  const payload: Record<string, unknown> = {
    project_id: milestone.project_id,
    title: milestone.title,
  };
  if (milestone.description != null) payload.description = milestone.description;
  if (milestone.status != null) payload.status = milestone.status;
  if (milestone.progress != null) {
    if (cols.has('progress')) payload.progress = milestone.progress;
    else if (cols.has('percentage')) payload.percentage = milestone.progress;
  }
  if (cols.has('start_date') && milestone.start_date != null) payload.start_date = milestone.start_date;
  if (cols.has('expected_end_date') && milestone.expected_end_date != null) {
    payload.expected_end_date = milestone.expected_end_date;
  }
  if (cols.has('completed_date') && milestone.completed_date != null) {
    payload.completed_date = milestone.completed_date;
  }
  if (milestone.due_date != null) payload.due_date = milestone.due_date;
  if (milestone.completed_at != null) payload.completed_at = milestone.completed_at;

  const { data, error } = await supabase
    .from('project_milestones')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[milestoneService] createMilestone failed:', error.code, error.message);
    throw new Error(friendlyMilestoneError('Failed to create milestone', error.message));
  }

  return normalizeMilestoneRow(data);
}

/**
 * Update an existing milestone (status → COMPLETED with completion timestamps,
 * progress/percentage, dates). Only columns that exist in the live database
 * are ever sent. `updated_at` is bumped automatically by the database trigger
 * when the Phase-7 migration is applied.
 */
export async function updateMilestone(
  milestoneId: string,
  updates: Partial<Omit<ProjectMilestone, 'id' | 'created_at'>>
): Promise<ProjectMilestone> {
  const cols = await resolveMilestoneColumns();
  const payload: Record<string, unknown> = {};
  if (updates.title != null) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status != null) payload.status = updates.status;
  if (updates.progress !== undefined) {
    if (cols.has('progress')) payload.progress = updates.progress;
    else if (cols.has('percentage')) payload.percentage = updates.progress;
  }
  if (cols.has('start_date') && updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (cols.has('expected_end_date') && updates.expected_end_date !== undefined) {
    payload.expected_end_date = updates.expected_end_date;
  }
  if (cols.has('completed_date') && updates.completed_date !== undefined) {
    payload.completed_date = updates.completed_date;
  }
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;
  if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;

  if (Object.keys(payload).length === 0) {
    throw new Error('No milestone fields to update.');
  }

  const { data, error } = await supabase
    .from('project_milestones')
    .update(payload)
    .eq('id', milestoneId)
    .select()
    .single();

  if (error) {
    console.error('[milestoneService] updateMilestone failed:', error.code, error.message);
    throw new Error(friendlyMilestoneError('Failed to update milestone', error.message));
  }

  return normalizeMilestoneRow(data);
}

/**
 * Suggested construction stages for a new project.
 * These match the Phase 9 recommended workflow.
 */
export const SUGGESTED_CONSTRUCTION_STAGES = [
  'Foundation',
  'Structure',
  'Roofing',
  'Interior',
  'Completion',
] as const;

/**
 * Initialize a project with the suggested construction stages.
 * Creates milestones for each stage with PENDING status and 0% progress.
 * Milestones are ordered by the suggested stage sequence.
 * Returns the created milestones (empty array if milestones already exist).
 */
export async function initializeProjectStages(projectId: string): Promise<ProjectMilestone[]> {
  // Check if milestones already exist for this project
  const existing = await getMilestonesByProject(projectId);
  if (existing.length > 0) {
    return []; // Don't overwrite existing milestones
  }

  const cols = await resolveMilestoneColumns();
  const created: ProjectMilestone[] = [];

  for (let i = 0; i < SUGGESTED_CONSTRUCTION_STAGES.length; i++) {
    const stageName = SUGGESTED_CONSTRUCTION_STAGES[i];
    const payload: Record<string, unknown> = {
      project_id: projectId,
      title: stageName,
      description: `${stageName} stage`,
      status: 'PENDING',
    };

    if (cols.has('progress')) payload.progress = 0;
    else if (cols.has('percentage')) payload.percentage = 0;
    if (cols.has('start_date')) payload.start_date = null;
    if (cols.has('expected_end_date')) payload.expected_end_date = null;
    payload.due_date = null;
    payload.completed_at = null;

    const { data, error } = await supabase
      .from('project_milestones')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn(`[milestoneService] Failed to create stage "${stageName}":`, error.message);
      continue;
    }

    created.push(normalizeMilestoneRow(data));
  }

  return created;
}

/**
 * Delete a milestone.
 */
export async function deleteMilestone(milestoneId: string): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', milestoneId);

  if (error) {
    console.error('[milestoneService] deleteMilestone failed:', error.message);
    throw new Error(friendlyMilestoneError('Failed to delete milestone', error.message));
  }
}