import { supabase } from '../lib/supabase';
import {
  Project,
  CreateProjectData,
  UpdateProjectData,
} from '../types/project';

/**
 * Project service — CRUD operations for `public.projects` via Supabase.
 *
 * Phase-4 contract:
 *  - The customer ID ALWAYS comes from supabase.auth.getUser(), never from the
 *    form payload (RLS ownership: auth.uid() = customer_id).
 *  - The insert payload is built against the ACTUAL live table columns. The
 *    Phase-4 columns (project_type, plot_size, budget_min, budget_max,
 *    construction_stage, requirements, contractor_id) are included ONLY when
 *    they exist in the live database (they are added by
 *    supabase/migrations/20260816130000_projects_customer_rls.sql). Nothing
 *    that doesn't exist in the DB is ever sent (no 42703 / PGRST204).
 *  - Errors are NEVER swallowed: Supabase code/message/details/hint are
 *    surfaced so diagnostics are possible in development.
 */

// Columns verified to exist on the live public.projects table.
const BASE_COLUMNS = [
  'id',
  'customer_id',
  'name',
  'description',
  'building_type',
  'city',
  'state',
  'built_up_area',
  'floors',
  'bedrooms',
  'bathrooms',
  'budget',
  'soil_type',
  'status',
  'priority',
  'design_style',
  'created_at',
  'updated_at',
];

// Phase-4 columns added by the migration — included only when present.
const PHASE4_COLUMNS = [
  'contractor_id',
  'selected_at',
  'project_type',
  'plot_size',
  'budget_min',
  'budget_max',
  'construction_stage',
  'requirements',
];

// Phase-2 column (20260907120000_projects_phase2_timeline.sql) — probed like
// the Phase-4 columns so inserts work before AND after the migration is
// applied to the live database.
const PHASE2_COLUMNS = ['timeline'];

// Phase-1 columns (20260909100000_projects_phase1_requirement_capture.sql) —
// probed so inserts work before AND after the migration is applied.
const PHASE1_COLUMNS = ['full_address', 'preferred_materials'];

// Fields caller → column mapping used by create/update (order does not matter).
const FIELD_TO_COLUMN: ReadonlyArray<readonly [string, string]> = [
  ['name', 'name'],
  ['project_type', 'project_type'],
  ['building_type', 'building_type'],
  ['full_address', 'full_address'],
  ['city', 'city'],
  ['state', 'state'],
  ['plot_size', 'plot_size'],
  ['built_up_area', 'built_up_area'],
  ['floors', 'floors'],
  ['bedrooms', 'bedrooms'],
  ['bathrooms', 'bathrooms'],
  ['preferred_materials', 'preferred_materials'],
  ['budget', 'budget'],
  ['budget_min', 'budget_min'],
  ['budget_max', 'budget_max'],
  ['construction_stage', 'construction_stage'],
  ['description', 'description'],
  ['requirements', 'requirements'],
  ['timeline', 'timeline'],
  ['soil_type', 'soil_type'],
  ['priority', 'priority'],
  ['design_style', 'design_style'],
  ['contractor_id', 'contractor_id'],
  ['selected_at', 'selected_at'],
];

// The legacy live status constraint allows only these values.
const LIVE_ALLOWED_STATUS = ['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

let columnProbePromise: Promise<Set<string>> | null = null;

/**
 * Returns the set of columns that actually exist on public.projects.
 * Probed once per session via PostgREST (a select on a missing column returns
 * PGRST204/42703). The base/migration union means the app works BOTH before
 * and after the Phase-4 migration is applied to the live database.
 */
function resolveProjectColumns(): Promise<Set<string>> {
  if (!columnProbePromise) {
    columnProbePromise = (async () => {
      const found = new Set<string>(BASE_COLUMNS);
      await Promise.all(
        [...PHASE4_COLUMNS, ...PHASE2_COLUMNS, ...PHASE1_COLUMNS].map(async (column) => {
          const { error } = await supabase
            .from('projects')
            .select(column)
            .limit(0);
          if (!error) found.add(column);
        })
      );
      return found;
    })();
  }
  return columnProbePromise;
}

/**
 * Builds a DB insert/update payload from caller data, dropping:
 *  - every field whose column does not exist in the live table, and
 *  - undefined/null/empty values (the DB DEFAULTs handle omitted columns).
 *
 * `status` is handled specially: the legacy live constraint and the Phase-4
 * constraint accept different value lists, so it is only forwarded when it is
 * guaranteed to be accepted by whichever schema is actually installed.
 */
async function buildProjectPayload(
  data: Partial<CreateProjectData>,
  enforceCustomerId?: string
): Promise<Record<string, unknown>> {
  const columns = await resolveProjectColumns();
  const phase4Applied = columns.has('project_type');
  const payload: Record<string, unknown> = {};

  for (const [field, column] of FIELD_TO_COLUMN) {
    if (!columns.has(column)) continue;
    const value = (data as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === '') continue;
    payload[column] = value;
  }

  const requestedStatus = data.status;
  if (requestedStatus) {
    // Phase-4 constraint: DRAFT/SUBMITTED/IN_PROGRESS/COMPLETED/CANCELLED.
    // Legacy constraint:  PLANNING/IN_PROGRESS/COMPLETED/CANCELLED.
    const acceptedOnLegacy = LIVE_ALLOWED_STATUS.includes(requestedStatus);
    const acceptedOnPhase4 =
      phase4Applied &&
      ['DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(
        requestedStatus
      );
    if (acceptedOnLegacy || acceptedOnPhase4) {
      payload.status = requestedStatus;
    }
    // Otherwise drop it — the DB DEFAULT ('PLANNING' legacy / 'DRAFT' after
    // migration) is applied instead of a 23514 check violation.
  }

  if (enforceCustomerId) {
    payload.customer_id = enforceCustomerId;
  }
  return payload;
}

/** Format a Supabase error with code/message/details/hint for dev visibility. */
function formatDbError(
  context: string,
  error: { code?: string; message?: string; details?: string | null; hint?: string | null }
): string {
  const parts = [
    context,
    error.code ? `[${error.code}]` : null,
    error.message,
    error.details ? `details: ${error.details}` : null,
    error.hint ? `hint: ${error.hint}` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(' — ');
}

/** The authenticated user's id, or a clear "log in" error. */
async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    console.error('[projectService] auth.getUser failed:', error?.message ?? 'no user');
    throw new Error('Please log in to create a project.');
  }
  return user.id;
}

/**
 * Create a project for the AUTHENTICATED customer.
 * The inserted row's customer_id is ALWAYS `user.id` — never from the form.
 */
export async function createProject(project: CreateProjectData): Promise<Project> {
  const userId = await getAuthenticatedUserId();
  // Never trust a caller-supplied customer_id (it is not part of the type).
  const payload = await buildProjectPayload(project, userId);

  const hasName = typeof payload.name === 'string' && payload.name.trim().length > 0;
  const hasCity = typeof payload.city === 'string' && payload.city.trim().length > 0;
  const hasState = typeof payload.state === 'string' && payload.state.trim().length > 0;
  if (!hasName || !hasCity || !hasState) {
    throw new Error('Project name, city and state are required.');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(payload)
    .select()
    .single();

  if (error) {
    // 42501 → RLS INSERT policy missing; 23502 → NOT NULL column missing;
    // 42703 / PGRST204 → payload column not in DB; 23514 → CHECK (status …).
    const message = formatDbError('Failed to create project', error);
    console.error('[projectService] createProject failed:', message);
    throw new Error(message);
  }

  return data as Project;
}

/**
 * Fetch all projects for the authenticated customer (RLS also guarantees
 * ownership; the explicit filter is a second layer of defense).
 */
export async function getProjectsByCustomer(customerId: string): Promise<Project[]> {
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('customer_id', customerId || userId)
    .order('created_at', { ascending: false });

  if (error) {
    const message = formatDbError('Failed to fetch projects', error);
    console.error('[projectService] getProjectsByCustomer failed:', message);
    throw new Error(message);
  }

  return (data as Project[]) ?? [];
}

/**
 * Fetch one project by id. Returns null when it does not exist (or is not
 * visible to the caller — RLS keeps other customers' rows invisible).
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    // PGRST116 (no rows) is handled by maybeSingle → data === null.
    const message = formatDbError('Failed to fetch project', error);
    console.error('[projectService] getProjectById failed:', message);
    throw new Error(message);
  }

  return (data as Project | null) ?? null;
}

/**
 * Update an existing project (authenticated owner only; RLS enforced).
 * Unknown columns are pruned; `status` is only forwarded when valid.
 */
export async function updateProject(
  projectId: string,
  updates: UpdateProjectData
): Promise<Project> {
  await getAuthenticatedUserId();

  const payload = await buildProjectPayload(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error('No updatable fields provided.');
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    const message = formatDbError('Failed to update project', error);
    console.error('[projectService] updateProject failed:', message);
    throw new Error(message);
  }

  return data as Project;
}

/**
 * Delete a project (authenticated owner only; RLS enforced).
 */
export async function deleteProject(projectId: string): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    const message = formatDbError('Failed to delete project', error);
    console.error('[projectService] deleteProject failed:', message);
    throw new Error(message);
  }
}

/**
 * Phase 6: Assign a contractor to a project in Supabase.
 *
 * Persists `projects.contractor_id` = the selected contractor's
 * `contractor_profiles.id` (the recommendations are built from
 * contractor_profiles rows, so `contractor.id` IS that id) and the app's
 * CONTRACTOR_SELECTED status.
 *
 * The migration 20260915120000_contractor_assignment_access.sql adds
 * CONTRACTOR_SELECTED to the live projects_status_check constraint. On a
 * database where that migration is not applied yet (error 23514) the status
 * write is retried WITHOUT the status so the assignment itself is still
 * persisted truthfully — the row is never mislabelled as IN_PROGRESS.
 *
 * The saved row is then verified: if `contractor_id` did not persist (RLS /
 * policy rejection) this THROWS instead of reporting a false success.
 */
export async function assignContractorToProject(
  projectId: string,
  contractorId: string
): Promise<Project> {
  await getAuthenticatedUserId();

  if (!projectId || !contractorId) {
    throw new Error('A project and a contractor are required for an assignment.');
  }

  const nowIso = new Date().toISOString();
  const columns = await resolveProjectColumns();
  const baseUpdate: Record<string, unknown> = {
    contractor_id: contractorId,
    updated_at: nowIso,
  };

  if (columns.has('selected_at')) {
    baseUpdate.selected_at = nowIso;
  }

  let attempt = await supabase
    .from('projects')
    .update({ ...baseUpdate, status: 'CONTRACTOR_SELECTED' })
    .eq('id', projectId)
    .select()
    .single();

  if (attempt.error && attempt.error.code === '23514') {
    console.warn(
      '[projectService] assignContractorToProject: CONTRACTOR_SELECTED rejected by the ' +
        'projects_status_check constraint — retrying without the status change.'
    );
    attempt = await supabase
      .from('projects')
      .update(baseUpdate)
      .eq('id', projectId)
      .select()
      .single();
  }

  if (attempt.error) {
    const message = formatDbError('Failed to assign contractor to project', attempt.error);
    console.error('[projectService] assignContractorToProject failed:', message);
    throw new Error(message);
  }

  const saved = attempt.data as Project | null;

  // Verify persistence before the UI claims success.
  if (!saved || String(saved.contractor_id) !== String(contractorId)) {
    throw new Error(
      'The contractor assignment was not saved to your project. Please refresh and try again.'
    );
  }

  return saved;
}

/**
 * Phase 6: Fetch projects assigned to a contractor (for Contractor Workspace).
 *
 * Scoped strictly to the caller's own assignments — the previous implementation
 * OR'd in `status IN (IN_PROGRESS, CONTRACTOR_SELECTED)`, which would let one
 * contractor see every other contractor's active project.
 */
export async function getProjectsByContractor(contractorId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('contractor_id', contractorId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[projectService] getProjectsByContractor warning:', error.message);
    return [];
  }

  return (data as Project[]) ?? [];
}