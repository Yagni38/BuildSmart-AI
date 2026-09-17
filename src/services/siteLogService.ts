// Robust, schema-faithful helpers for site_logs (contractor daily work updates).
//
// Columns mirror the LIVE schema — see:
//   supabase/migrations/20260908140000_phase7_milestone_tracker_schema.sql  (site_logs: log_date, milestone_id, ...)
//   supabase/migrations/20260908160000_phase8_construction_photo_updates.sql (image_url)
//   supabase/migrations/20260915120000_contractor_assignment_access.sql     (INSERT policy: is_assigned_contractor(project_id))
//
// NOTE: contractor_profiles has NO user_id column (verified). The contractor
// identity used here is projects.contractor_id (== contractor_profiles.id),
// which is exactly what the RLS policy checks.
import { supabase } from '../lib/supabase';

export interface SiteLogInsert {
  project_id: string;
  contractor_id: string;
  description: string;
  milestone_id?: string | null;
  image_url?: string | null;
  /** YYYY-MM-DD — stored in site_logs.log_date */
  log_date?: string;
  notes?: string | null;
}

export interface SiteLogRow {
  id: string;
  project_id: string;
  contractor_id: string | null;
  milestone_id: string | null;
  description: string | null;
  image_url: string | null;
  log_date: string | null;
  created_at: string;
}

/** Turn a raw PostgREST/Supabase error into a precise, user-readable message. */
export function describeSupabaseError(err: unknown, fallback: string): string {
  const e = err as { message?: string; code?: string; details?: string; hint?: string } | null | undefined;
  if (!e) return fallback;
  const parts = [e.message, e.details, e.hint].filter((p): p is string => Boolean(p));
  const code = e.code ? ` (code ${e.code})` : '';
  return parts.length > 0 ? `${parts.join(' — ')}${code}` : fallback;
}

const SITE_LOG_COLUMNS =
  'id, project_id, contractor_id, milestone_id, description, image_url, log_date, created_at';

/**
 * Insert one daily work update. Throws a precise Error on ANY failure so the
 * caller can avoid showing a false success message.
 */
export async function postSiteLog(payload: SiteLogInsert): Promise<SiteLogRow> {
  const row: Record<string, unknown> = {
    project_id: payload.project_id,
    contractor_id: payload.contractor_id,
    description: payload.description,
    log_date: payload.log_date ?? new Date().toISOString().slice(0, 10),
  };
  if (payload.milestone_id) row.milestone_id = payload.milestone_id;
  if (payload.image_url) row.image_url = payload.image_url;
  if (payload.notes) row.notes = payload.notes;

  const { data, error } = await supabase
    .from('site_logs')
    .insert(row)
    .select(SITE_LOG_COLUMNS)
    .single();

  if (error) {
    throw new Error(describeSupabaseError(error, 'Failed to save the update to the database.'));
  }
  return data as SiteLogRow;
}

/** Read updates for one project, newest first (used by contractor/customer/admin views). */
export async function fetchProjectSiteLogs(projectId: string, limit = 50): Promise<SiteLogRow[]> {
  const { data, error } = await supabase
    .from('site_logs')
    .select(SITE_LOG_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(describeSupabaseError(error, 'Failed to load project updates.'));
  }
  return (data ?? []) as SiteLogRow[];
}
