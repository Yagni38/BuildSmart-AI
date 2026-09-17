import { supabase } from '../lib/supabase';
import { ConstructionPhoto } from '../types/project';
import { resolveCurrentContractorId } from './contractorDashboardService';

/**
 * Construction Photo service (Phase 13) — upload, list, and delete construction
 * progress photos.
 *
 * LIVE DATABASE: the real public.construction_photos table does NOT exist in
 * the live schema. Progress photos are therefore stored in public.site_logs,
 * whose live columns are:
 *   id, project_id, contractor_id, milestone_id, description, image_url, created_at
 * A "photo" is a site_logs row where image_url is not null. Photos and site
 * updates share one table, exactly as the live schema supports.
 *
 * Storage bucket used: `construction-updates` (must exist; created by the
 * Phase 8 migration when it is applied).
 */

const BUCKET = 'construction-updates';

function formatDbError(action: string, error: { message: string; code?: string }): string {
  const code = error.code ? ` [${error.code}]` : '';
  return `${action}: ${error.message}${code}`;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Please log in to manage construction photos.');
  }
  return data.user.id;
}

/** Map a site_logs row onto the ConstructionPhoto view model. */
function mapSiteLogRowToPhoto(row: any): ConstructionPhoto {
  return {
    id: row.id,
    project_id: row.project_id,
    contractor_id: row.contractor_id ?? null,
    milestone_id: row.milestone_id ?? null,
    image_url: row.image_url ?? '',
    caption: row.description ?? null,
    created_at: row.created_at,
  };
}

/**
 * Fetch all construction photos for a project (site_logs rows with an image),
 * newest first.
 */
export async function getConstructionPhotos(
  projectId: string
): Promise<ConstructionPhoto[]> {
  const { data, error } = await supabase
    .from('site_logs')
    .select('*')
    .eq('project_id', projectId)
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[constructionPhotoService] getConstructionPhotos failed:', error.message);
    throw new Error(formatDbError('Failed to load construction photos', error));
  }

  return ((data ?? []) as any[]).map(mapSiteLogRowToPhoto);
}

/**
 * Upload a progress photo to storage and persist it as a site_logs row.
 *
 * Storage path: construction-updates/<project_id>/<contractor_id>-<timestamp>-<sanitized-filename>
 *
 * Returns the saved ConstructionPhoto view model.
 */
export async function uploadConstructionPhoto(
  projectId: string,
  file: File,
  opts?: { caption?: string | null; milestoneId?: string | null }
): Promise<ConstructionPhoto> {
  // site_logs.contractor_id must be the caller's contractors row (live FK
  // site_logs_contractor_id_fkey → contractors.id). Resolve it BEFORE the
  // storage upload so an unregistered contractor fails fast with a clear
  // error instead of leaving an orphaned photo in the bucket.
  const contractorId = await resolveCurrentContractorId();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${projectId}/${contractorId}-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) {
    console.error('[constructionPhotoService] storage upload failed:', uploadError.message);
    throw new Error(formatDbError('Image upload failed', uploadError));
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const imageUrl = urlData.publicUrl;

  const { data, error } = await supabase
    .from('site_logs')
    .insert({
      project_id: projectId,
      contractor_id: contractorId,
      milestone_id: opts?.milestoneId ?? null,
      description: opts?.caption ?? null,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error) {
    // Best-effort: remove the orphaned storage object if the DB insert fails.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});

    console.error('[constructionPhotoService] insert failed:', error.message);
    throw new Error(formatDbError('Failed to save photo metadata', error));
  }

  return mapSiteLogRowToPhoto(data);
}

/**
 * Delete a construction photo (site_logs metadata row + storage object).
 */
export async function deleteConstructionPhoto(photoId: string): Promise<void> {
  // Fetch the row first so we can compute the storage path to remove.
  const { data: row, error: fetchError } = await supabase
    .from('site_logs')
    .select('id, project_id, contractor_id, image_url')
    .eq('id', photoId)
    .maybeSingle();

  if (fetchError) {
    console.error('[constructionPhotoService] fetch before delete failed:', fetchError.message);
    throw new Error(formatDbError('Failed to load photo before delete', fetchError));
  }

  if (!row) {
    throw new Error('Photo not found or already deleted.');
  }

  // Delete the metadata row.
  const { error: dbError } = await supabase
    .from('site_logs')
    .delete()
    .eq('id', photoId);

  if (dbError) {
    console.error('[constructionPhotoService] delete failed:', dbError.message);
    throw new Error(formatDbError('Failed to delete photo', dbError));
  }

  // Best-effort: also remove the storage object. Derive the object path from
  // the public URL (everything after the bucket segment).
  try {
    const url = new URL(row.image_url);
    const segments = url.pathname.split('/').filter(Boolean);
    const bucketIdx = segments.indexOf(BUCKET);
    if (bucketIdx >= 0 && bucketIdx < segments.length - 1) {
      const objectPath = segments.slice(bucketIdx + 1).join('/');
      await supabase.storage.from(BUCKET).remove([objectPath]);
    }
  } catch (err) {
    console.warn('[constructionPhotoService] storage cleanup failed (non-fatal):', err);
  }
}
