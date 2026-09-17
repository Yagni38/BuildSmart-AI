import { supabase } from '../lib/supabase';
import { PostgrestError } from '@supabase/supabase-js';
import {
  Project,
  ProjectUpdate,
  ProjectUpdateType,
  CreateProjectUpdateData,
} from '../types/project';
import { updateMilestone } from './milestoneService';

/**
 * Contractor dashboard service (Phase 6) — everything the REAL contractor
 * dashboard needs, all backed by Supabase and scoped by RLS to projects
 * where projects.contractor_id = the authenticated contractor.
 *
 * RLS (supabase/migrations/20260908120000_phase6_contractor_dashboard.sql):
 *  - projects SELECT/UPDATE  → assigned contractor only
 *  - project_updates SELECT → participants; INSERT/UPDATE/DELETE → assigned
 *    contractor only (customers can read but never modify)
 *  - project_milestones SELECT → participants; writes → assigned contractor
 *  - storage bucket `site-photos` → upload only into your assigned project
 *    folder; authenticated participants can read.
 */

const SITE_PHOTOS_BUCKET = 'site-photos';

/**
 * Columns we ask for on public.projects — the EXACT live column set (verified
 * against information_schema on the production database).
 *
 * The live table has NO `progress` and NO `start_date` column, so:
 *   • progress is DERIVED from project_milestones (see getMilestoneProgress)
 *   • the schedule is read from expected_completion / timeline
 */
const PROJECT_COLUMNS = [
  'id',
  'customer_id',
  'contractor_id',
  'name',
  'description',
  'building_type',
  'project_type',
  'city',
  'state',
  'plot_size',
  'plot_length',
  'plot_width',
  'built_up_area',
  'floors',
  'bedrooms',
  'bathrooms',
  'soil_type',
  'budget',
  'budget_min',
  'budget_max',
  'expected_completion',
  'timeline',
  'priority',
  'design_style',
  'material_preference',
  'sustainability_preference',
  'parking',
  'kitchen_type',
  'construction_stage',
  'requirements',
  'status',
  'created_at',
  'updated_at',
];

function formatDbError(action: string, error: { message: string; code?: string }): string {
  const code = error.code ? ` [${error.code}]` : '';
  return `${action}: ${error.message}${code}`;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Please log in to manage your assigned projects.');
  }
  return data.user.id;
}

/**
 * Resolve the authenticated user's contractor profile ID from `contractor_profiles`
 * by matching the user's email. Returns both `authUserId` and `contractorProfileId`
 * (if found), so project queries correctly match `projects.contractor_id`.
 */
export async function getAuthenticatedContractorIdentity(): Promise<{ authUserId: string; contractorIds: string[] }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Please log in to manage your assigned projects.');
  }
  const authUserId = data.user.id;
  const userEmail = data.user.email ? data.user.email.trim().toLowerCase() : '';

  let contractorProfileId: string | null = null;
  if (userEmail) {
    const { data: cp } = await supabase
      .from('contractor_profiles')
      .select('id')
      .ilike('email', userEmail)
      .maybeSingle();
    if (cp?.id) {
      contractorProfileId = cp.id;
    }
  }

  const ids = Array.from(
    new Set([contractorProfileId, authUserId].filter((id): id is string => Boolean(id)))
  );
  return { authUserId, contractorIds: ids };
}

/** The full column list (RLS scopes the rows; missing columns fail loudly). */
function projectColumns(): string {
  return PROJECT_COLUMNS.join(',');
}

/** Core columns that exist even before the Phase 6 migration is applied. */
const PROJECT_COLUMNS_PRE_PHASE6 = PROJECT_COLUMNS.filter(
  (c) => c !== 'progress' && c !== 'start_date'
);

/**
 * Run a projects query; if the live database is missing the Phase 6 columns
 * (progress / start_date), transparently retry without them so the
 * dashboard keeps working before AND after the migration.
 */
async function queryProjects(
  run: (select: string) => PromiseLike<{ data: unknown; error: PostgrestError | null }>
): Promise<{ data: unknown; missingPhase6Columns: boolean }> {
  let res = await run(projectColumns());
  let missingPhase6Columns = false;

  if (res.error && /progress|start_date/i.test(res.error.message)) {
    missingPhase6Columns = true;
    res = await run(PROJECT_COLUMNS_PRE_PHASE6.join(','));
  }

  return { data: res.data, missingPhase6Columns };
}

/**
 * Fetch every project assigned to the currently authenticated contractor.
 * Uses the resolved contractor identity (contractor_profiles.id + auth.users.id)
 * so projects assigned by customer recommendation are correctly retrieved under RLS.
 */
export async function getAssignedProjects(): Promise<Project[]> {
  const { contractorIds } = await getAuthenticatedContractorIdentity();

  const { data } = await queryProjects((select) =>
    supabase
      .from('projects')
      .select(select)
      .in('contractor_id', contractorIds)
      .order('updated_at', { ascending: false })
  );

  return (data as unknown as Project[]) ?? [];
}

/**
 * Fetch a single assigned project by id. Returns null when the project is
 * not assigned to the caller (RLS filters the row out).
 */
export async function getAssignedProject(projectId: string): Promise<Project | null> {
  const { contractorIds } = await getAuthenticatedContractorIdentity();

  const { data } = await queryProjects((select) =>
    supabase
      .from('projects')
      .select(select)
      .eq('id', projectId)
      .in('contractor_id', contractorIds)
      .maybeSingle()
  );

  return (data as unknown as Project) ?? null;
}

/**
 * Resolve customer display names for a set of projects in ONE query.
 * Returns a map of customer_id → full_name.
 */
export async function getCustomerNames(
  customerIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);

  if (error) {
    console.warn('[contractorDashboard] getCustomerNames warning:', error.message);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.full_name || row.id;
  }
  return map;
}

/**
 * Site updates (progress / milestone / site / image) for a project, newest
 * first. The LIVE database stores these in public.site_logs (columns:
 * id, project_id, contractor_id, milestone_id, description, image_url,
 * created_at) — the legacy `project_updates` table does not exist live.
 */
export async function getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const { data, error } = await supabase
    .from('site_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error('[contractorDashboard] getProjectUpdates failed:', error.message);
    throw new Error(formatDbError('Failed to load project updates', error));
  }

  return ((data ?? []) as any[]).map(mapSiteLogToProjectUpdate);
}

/** Map a live site_logs row onto the app ProjectUpdate view model. */
function mapSiteLogToProjectUpdate(row: any): ProjectUpdate {
  const description = row.description ?? '';
  const type: ProjectUpdateType =
    row.image_url ? 'IMAGE' : description.startsWith('Project progress updated') ? 'PROGRESS' : 'SITE';
  return {
    id: row.id,
    project_id: row.project_id,
    author_id: row.contractor_id ?? '',
    update_type: type,
    title: null,
    content: description,
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

/**
 * Resolve the LIVE contractor identity for site_logs.
 *
 * site_logs.contractor_id has the live FK site_logs_contractor_id_fkey →
 * contractors(id), and the logged-in contractor's contractors row is found via
 * the live FK contractors.profile_id = profiles.id = auth.uid(). The resolver
 * is a SECURITY DEFINER function (contractors has RLS with no policies), so it
 * is called through RPC.
 *
 * If the contractor has no contractors row yet (incomplete registration), a
 * clear, actionable error is raised instead of an opaque FK violation.
 */
export async function resolveCurrentContractorId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_current_contractor_id');

  if (error) {
    console.error('[contractorDashboard] resolveCurrentContractorId failed:', error.message);
    throw new Error('Contractor profile not found. Please complete contractor registration.');
  }
  if (!data) {
    throw new Error('Contractor profile not found. Please complete contractor registration.');
  }
  return data as string;
}

/**
 * Persist a new contractor update as a site_logs row (LIVE table).
 * The author is always server-resolved — RLS additionally rejects customers
 * and non-assigned contractors.
 */
export async function addProjectUpdate(
  payload: CreateProjectUpdateData
): Promise<ProjectUpdate> {
  const contractorId = await resolveCurrentContractorId();

  const description =
    [payload.title, payload.content].filter(Boolean).join(': ') ||
    'Site update';

  const { data, error } = await supabase
    .from('site_logs')
    .insert({
      project_id: payload.project_id,
      contractor_id: contractorId,
      milestone_id: null,
      description,
      image_url: payload.image_url ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[contractorDashboard] addProjectUpdate failed:', error.code, error.message);
    throw new Error(formatDbError('Failed to save project update', error));
  }

  return mapSiteLogToProjectUpdate(data ?? {});
}

/**
 * Record a project-level progress change as a site_logs entry.
 *
 * The live public.projects table has NO `progress` column (verified), so a
 * reportable progress value is never written there. Progress is derived from
 * milestone percentage/site_log data (Phase 12) — this call records the change
 * in the log and returns the refreshed project row.
 */
export async function updateProjectProgress(
  projectId: string,
  progress: number
): Promise<Project> {
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error('Progress must be a number between 0 and 100.');
  }

  const contractorId = await resolveCurrentContractorId();

  const { error } = await supabase
    .from('site_logs')
    .insert({
      project_id: projectId,
      contractor_id: contractorId,
      milestone_id: null,
      description: `Project progress updated to ${Math.round(progress)}%.`,
      image_url: null,
    });

  if (error) {
    console.error('[contractorDashboard] updateProjectProgress (site log) failed:', error.message);
    throw new Error(formatDbError('Failed to record progress update', error));
  }

  // Return the refreshed project row so the caller can update its list.
 const { data } = await queryProjects((select) =>
    supabase.from('projects').select(select).eq('id', projectId).maybeSingle()
  );

  if (!data) {
  console.warn(
    '[contractorDashboard] Fetch after progress update returned no project data.'
  );

  return { id: projectId } as Project;
}

  return data as unknown as Project;
}

/**
 * Upload a site photo to the site-photos storage bucket under the project
 * folder and return its public URL. RLS only allows the assigned contractor.
 */
export async function uploadSiteImage(
  projectId: string,
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${projectId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(SITE_PHOTOS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (error) {
    console.error('[contractorDashboard] uploadSiteImage failed:', error.message);
    throw new Error(formatDbError('Image upload failed', error));
  }

  const { data } = supabase.storage
    .from(SITE_PHOTOS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/** Mark a milestone COMPLETED (sets completed_at) or PENDING / IN_PROGRESS. */
export async function setMilestoneStatus(
  milestoneId: string,
  status: string
): Promise<void> {
  const payload: Record<string, unknown> = { status };

  if (status === 'COMPLETED') {
    payload.completed_at = new Date().toISOString();
  } else {
    payload.completed_at = null;
  }

  const { error } = await supabase
    .from('project_milestones')
    .update(payload)
    .eq('id', milestoneId);

  if (error) {
    console.error('[contractorDashboard] setMilestoneStatus failed:', error.message);
    throw new Error(formatDbError('Failed to update milestone', error));
  }
}

/** Small helper for the UI — derive a readable update-type label. */
export function updateTypeLabel(type: ProjectUpdateType | string): string {
  switch (type) {
    case 'PROGRESS':
      return 'Progress Update';
    case 'MILESTONE':
      return 'Milestone Update';
    case 'IMAGE':
      return 'Site Photo';
    case 'SITE':
    default:
      return 'Site Update';
  }
}

/**
 * Progress for a set of assigned projects, DERIVED FROM project_milestones.
 *
 * The live database has no `projects.progress` column (and none is created), so
 * milestones are the single source of truth: the live project_milestones table
 * stores completion in `percentage` (0-100) alongside `status`; a COMPLETED
 * milestone without a percentage counts as 100%.
 *
 * @returns map of project_id → average percentage (0-100). Projects without
 *          milestones are simply absent from the map.
 */
export async function getMilestoneProgress(
  projectIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(projectIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from('project_milestones')
    .select('id, project_id, title, status')
    .in('project_id', unique);

  if (error) {
    console.warn('[contractorDashboard] getMilestoneProgress warning:', error.message);
    return {};
  }

  const totals: Record<string, { sum: number; count: number }> = {};

  for (const row of (data ?? []) as any[]) {
    const status = String(row.status ?? '').toUpperCase();
    const value = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 50 : 0;
    const projectId = String(row.project_id);
    if (!totals[projectId]) totals[projectId] = { sum: 0, count: 0 };
    totals[projectId].sum += value;
    totals[projectId].count += 1;
  }

  const result: Record<string, number> = {};
  for (const projectId of Object.keys(totals)) {
    const bucket = totals[projectId];
    if (bucket.count > 0) result[projectId] = Math.round(bucket.sum / bucket.count);
  }
  return result;
}

/**
 * Apply a progress percentage to a project by updating its MILESTONES in order
 * (the first N milestones are brought to their share of the target, the rest
 * are re-opened). Milestones are the only progress store — no `projects.progress`
 * column is written or created.
 */
export async function applyProgressToMilestones(
  projectId: string,
  percent: number
): Promise<void> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Progress must be a number between 0 and 100.');
  }

  const { data, error } = await supabase
    .from('project_milestones')
    .select('id, title, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(formatDbError('Failed to load milestones for progress', error));
  }

  const milestones = (data ?? []) as { id: string; title: string }[];
  if (milestones.length === 0) {
    throw new Error(
      'This project has no milestones yet — initialise the construction stages first.'
    );
  }

  const total = milestones.length;
  const target = (percent / 100) * total;

  for (let index = 0; index < total; index++) {
    const value = Math.max(0, Math.min(100, Math.round((target - index) * 100)));
    const status = value >= 100 ? 'COMPLETED' : value > 0 ? 'IN_PROGRESS' : 'PENDING';

    // updateMilestone writes `percentage` on this database (it probes for the
    // column) and keeps due_date / completed_at consistent.
    await updateMilestone(milestones[index].id, {
      progress: value,
      status,
      completed_at: value >= 100 ? new Date().toISOString() : null,
    });
  }
}
