import { supabase } from '../lib/supabase';
import { Contractor } from '../types';

/**
 * Contractor service — read operations for the `contractors` table.
 *
 * Phase 3: the public marketplace service only returns contractors whose
 * `verification_status` is `'VERIFIED'` (or the legacy `'APPROVED'` value
 * kept for backward compatibility). PENDING and REJECTED contractors are
 * NEVER returned here — the filter comes from the database (RLS + query).
 */

/** Normalize verification_status for safe case-insensitive comparison. NULL/empty => 'PENDING'. */
export function normalizeVerificationStatus(status: string | null | undefined): 'PENDING' | 'VERIFIED' | 'REJECTED' {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'VERIFIED' || s === 'APPROVED') return 'VERIFIED';
  if (s === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

/** True when a verification status belongs to the verified pool. */
export function isVerificationVerified(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toUpperCase();
  return s === 'VERIFIED' || s === 'APPROVED';
}

/**
 * Escape SQL LIKE/ILIKE wildcards so an email pattern matches exactly
 * (case-insensitively) instead of treating '_'/'%' as wildcards.
 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/([%_\\])/g, '\\$1');
}

/** Columns that exist on the LIVE contractor_profiles table. No user_id, no company_name, no description, no resume_path. */
const CONTRACTOR_PROFILE_COLUMNS = 'id, full_name, email, phone, location, skills, experience_years, project_types, resume_url, verification_status, created_at';

/**
 * Fetch ALL contractor_profiles rows (admin view). Filtering happens
 * client-side with case-insensitive normalization so lowercase 'pending'
 * or NULL statuses never silently disappear.
 */
export async function getAllContractorProfiles(): Promise<any[]> {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select(CONTRACTOR_PROFILE_COLUMNS)
    .order('created_at', { ascending: false });

  console.log('ADMIN CONTRACTOR QUERY RESULT:', data);
  if (error) {
    console.error('ADMIN CONTRACTOR QUERY ERROR:', error);
    throw new Error(`Failed to load contractors: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    profile_id: null,
    verification_status: row.verification_status,
    rejection_reason: null,
    experience_years: row.experience_years,
    skills: row.skills,
    project_types: row.project_types,
    specialty: row.project_types,
    location: row.location,
    created_at: row.created_at,
    updated_at: row.created_at,
    full_name: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    city: null,
    state: null,
    resume_path: null,
    resume_url: row.resume_url ?? null,
  }));
}

/**
 * Read the CURRENT contractor's OWN verification state from the LIVE
 * `contractor_profiles` table (owner-readable under RLS by email).
 *
 * The live public.profiles table has NO verification_status column, so the
 * contractor status gate must read the real status here. Only live columns
 * are selected — no user_id / resume_path / rejection_reason.
 */
export async function getOwnContractorVerification(
  email: string | null | undefined
): Promise<{ status: string | null }> {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return { status: null };

  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('verification_status')
    .ilike('email', escapeIlikePattern(normalized))
    .maybeSingle();

  if (error) {
    console.error('[contractorService] getOwnContractorVerification failed:', error.message);
    return { status: null };
  }

  return { status: (data as any)?.verification_status ?? null };
}

/**
 * PHASE 1 — read the CURRENT contractor's OWN full `contractor_profiles` row
 * (owner-readable under RLS by email; contractor_profiles.id = auth.users.id,
 * there is NO user_id column). Returns null when no row exists or the read
 * fails — callers must treat this as "no contractor data", never crash.
 * Only LIVE columns are selected: id, full_name, email, phone, location,
 * skills, experience_years, project_types, resume_url, verification_status,
 * created_at.
 */
export async function getOwnContractorProfile(
  email: string | null | undefined
): Promise<Record<string, any> | null> {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('contractor_profiles')
    .select(CONTRACTOR_PROFILE_COLUMNS)
    .ilike('email', escapeIlikePattern(normalized))
    .maybeSingle();

  if (error) {
    console.warn('[contractorService] getOwnContractorProfile warning:', error.message);
    return null;
  }

  return (data as Record<string, any>) ?? null;
}

/**
 * PHASE 1 — update the CURRENT contractor's OWN `contractor_profiles` row
 * (owner-update under RLS by email). Only LIVE columns are ever sent:
 * full_name, phone, location, skills, experience_years, project_types.
 * email and verification_status can NEVER be changed here (email is the
 * RLS identity; status changes are admin-only with a DB veto trigger).
 * Throws on failure so the UI can surface the real database error.
 */
export async function updateOwnContractorProfile(
  email: string | null | undefined,
  updates: {
    full_name?: string | null;
    phone?: string | null;
    location?: string | null;
    skills?: string | null;
    experience_years?: number | null;
    project_types?: string | null;
  }
): Promise<void> {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Your account email is required to update contractor details.');
  }

  const payload: Record<string, any> = {};
  if (updates.full_name !== undefined) payload.full_name = updates.full_name;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.skills !== undefined) payload.skills = updates.skills;
  if (updates.project_types !== undefined) payload.project_types = updates.project_types;
  if (updates.experience_years !== undefined) {
    payload.experience_years = updates.experience_years;
  }

  if (Object.keys(payload).length === 0) return;

  // Locate the caller's OWN row by email (the RLS identity — no user_id
  // column exists). A missing row is an explicit, actionable error instead of
  // a silent no-op.
  const { data: existing, error: lookupError } = await supabase
    .from('contractor_profiles')
    .select('id')
    .ilike('email', escapeIlikePattern(normalized))
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to locate your contractor profile: ${lookupError.message}`);
  }

  if (!existing) {
    throw new Error(
      'No contractor profile exists for your account yet. Please complete contractor registration first.'
    );
  }

  const { error } = await supabase
    .from('contractor_profiles')
    .update(payload)
    .eq('id', existing.id);

  if (error) {
    throw new Error(`Failed to update contractor details: ${error.message}`);
  }
}

/**
 * Fetch all verified contractors for the public marketplace from Supabase.
 * Queries `contractor_profiles` (the LIVE table) where
 * `verification_status IN ('VERIFIED', 'APPROVED')`. PENDING / REJECTED
 * rows are never returned — verified eligibility is enforced by the query.
 */
export async function getApprovedContractors(): Promise<any[]> {
  try {
    // LIVE source of truth: public.contractor_profiles. Uses only live
    // columns (no user_id / company_name / description / resume_path).
    // VERIFIED pool = statuses normalizing to VERIFIED (incl. legacy
    // APPROVED); PENDING/REJECTED/NULL never enter recommendations.
    const { data, error } = await supabase
      .from('contractor_profiles')
      .select(CONTRACTOR_PROFILE_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[contractorService] getApprovedContractors failed:', error.message);
      return [];
    }

    return (data ?? [])
      .filter((row: any) => normalizeVerificationStatus(row.verification_status) === 'VERIFIED')
      .map(mapContractorProfileToMarketplaceContractor);
  } catch (err: any) {
    console.error('[contractorService] getApprovedContractors error:', err?.message || err);
    return [];
  }
}

/**
 * Helper to map a legacy profiles row to a Marketplace Contractor object
 * (kept for backwards compatibility with pre-live-schema rows). No rating /
 * reviews / projects / price values are invented.
 */
export function mapProfileToMarketplaceContractor(p: any): any {
  return {
    id: p.id,
    company: `${p.full_name || 'Verified Contractor'} Builders`,
    owner: p.full_name || 'Verified Contractor',
    experience: p.years_of_experience != null ? Number(p.years_of_experience) : 0,
    projects: null,
    rating: null,
    reviewsCount: null,
    priceEstimate: null,
    completionTime: null,
    responseTime: null,
    verified: isVerificationVerified(p.verification_status),
    matchScore: null,
    matchReason: p.description || 'Verified contractor profile.',
    specialty: p.project_types || p.skills || 'Residential Construction',
    location: p.location || null,
    warranty: null,
    materialQuality: null,
    description: p.description || 'Verified contractor profile.',
    skills: p.skills || '',
    projectTypes: p.project_types || '',
    email: p.email,
    phone: p.phone,
    verificationStatus: isVerificationVerified(p.verification_status) ? 'VERIFIED' : (p.verification_status || 'PENDING')
  };
}

/**
 * Helper to map a LIVE contractor_profiles row to a Marketplace Contractor object.
 *
 * No rating / reviews / projects-completed / price / warranty values are
 * invented: the live table simply has no such columns, so the returned object
 * carries nulls and the UI renders "Not rated"/"—" instead of fake numbers.
 */
export function mapContractorProfileToMarketplaceContractor(cp: any): any {
  return {
    id: cp.id,
    company: `${cp.full_name || 'Verified Contractor'} Builders`,
    owner: cp.full_name || 'Verified Contractor',
    experience: cp.experience_years != null ? Number(cp.experience_years) : 0,
    projects: null,
    rating: null,
    reviewsCount: null,
    priceEstimate: null,
    completionTime: null,
    responseTime: null,
    verified: isVerificationVerified(cp.verification_status),
    matchScore: null,
    matchReason: cp.description || 'Verified contractor profile with complete documentation.',
    specialty: cp.project_types || cp.skills || 'Residential Construction',
    location: cp.location || null,
    warranty: null,
    materialQuality: null,
    description: cp.description || 'Verified contractor profile.',
    skills: cp.skills || '',
    projectTypes: cp.project_types || '',
    email: cp.email,
    phone: cp.phone,
    resume_url: cp.resume_url ?? null,
    verificationStatus: isVerificationVerified(cp.verification_status) ? 'VERIFIED' : (cp.verification_status || 'PENDING')
  };
}

/**
 * Fetch a single verified contractor by its LIVE UUID (contractor_profiles.id).
 * Only returns the contractor if they are verified (VERIFIED or legacy APPROVED).
 */
export async function getContractorById(contractorId: string): Promise<Contractor | null> {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select(CONTRACTOR_PROFILE_COLUMNS)
    .eq('id', contractorId)
    .maybeSingle();

  if (error) {
    console.error('[contractorService] getContractorById failed:', error.message);
    throw new Error(`Failed to fetch contractor: ${error.message}`);
  }

  if (!data) return null;

  // Only verified contractors resolve via this lookup; pending/rejected/NULL
  // rows return null so they never enter the recommendation pool.
  if (normalizeVerificationStatus(data.verification_status) !== 'VERIFIED') return null;

  const mapped = mapContractorProfileToMarketplaceContractor(data);
  return {
    id: mapped.id,
    profile_id: mapped.id,
    company_name: mapped.company,
    owner_name: mapped.owner,
    experience_years: mapped.experience,
    projects_completed: 0,
    rating: 0,
    reviews_count: 0,
    price_estimate_lakhs: 0,
    completion_time_months: 0,
    response_time: '—',
    verification_status: (data.verification_status ?? 'PENDING') as Contractor['verification_status'],
    match_score: 0,
    match_reason: null,
    specialty: mapped.specialty,
    location: mapped.location || '—',
    warranty_years: 0,
    material_quality: null,
    created_at: data.created_at,
    updated_at: data.created_at,
  };
}

/**
 * Register or update a contractor's professional profile.
 *
 * 1. Uploads resume file to the `contractor-resumes` Supabase storage bucket.
 * 2. Updates `profiles` table with contractor metadata and sets `verification_status` to `'PENDING'`.
 * 3. Upserts into `contractor_profiles` table.
 */
export async function registerContractorProfile(
  userId: string,
  data: {
    full_name: string;
    email: string;
    phone: string;
    location: string;
    skills: string;
    years_of_experience: number;
    project_types: string;
    // PHASE 1: company_name / description removed — the LIVE
    // contractor_profiles table has no such columns, so they were collected
    // but never persisted. Only live columns are accepted now.
    resume_file?: File | null;
  },
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; resumeUrl?: string; message: string }> {
  let resumePath: string | null = null;
  let resumeUrl: string | null = null;

  // 1. Upload resume to Supabase Storage bucket 'contractor-resumes'
  if (data.resume_file) {
    if (onProgress) onProgress(20);
    const safeFileName = data.resume_file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    resumePath = `${userId}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('contractor-resumes')
      .upload(resumePath, data.resume_file, {
        cacheControl: '3600',
        upsert: false,
        contentType: data.resume_file.type || 'application/pdf',
      });

    if (uploadError) {
      console.error('[contractorService] Resume upload error:', uploadError.message);
      throw new Error(`Resume upload failed: ${uploadError.message}`);
    }

    if (onProgress) onProgress(60);

    const { data: publicUrlData } = supabase.storage
      .from('contractor-resumes')
      .getPublicUrl(resumePath);

    resumeUrl = publicUrlData.publicUrl;
  }

  if (onProgress) onProgress(80);

  // 2. Update the auth profiles row — ONLY columns that exist on the live
  //    public.profiles table (id, full_name, email, phone, role, city, state,
  //    avatar_url, created_at, updated_at). Contractor metadata (location,
  //    skills, verification_status, …) does NOT exist on profiles in the live
  //    database, so it is never written there. Failure here is non-fatal: the
  //    authoritative contractor record lives in contractor_profiles below.
  const profileUpdates: Record<string, any> = {};
  if (data.full_name) profileUpdates.full_name = data.full_name.trim();
  if (data.phone) profileUpdates.phone = data.phone.trim();

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);

    if (profileError) {
      console.warn('[contractorService] profiles update warning (non-fatal):', profileError.message);
    }
  }

  // 3. Create/update the contractor_profiles row.
  //    The LIVE contractor_profiles table has NO user_id / company_name /
  //    description / resume_path / updated_at columns. Its primary key `id`
  //    IS the contractor identifier stored in projects.contractor_id, so the
  //    contractor row is located by the unique auth email instead of user_id.
  const contractorProfileRow = {
    full_name: data.full_name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim() || null,
    location: data.location.trim() || null,
    skills: data.skills.trim() || null,
    experience_years: Number(data.years_of_experience || 0),
    project_types: data.project_types.trim() || null,
    resume_url: resumeUrl,
    verification_status: 'PENDING',
  };

  // Case-insensitive lookup (wildcards escaped) so a legacy row stored with a
  // mixed-case email is found and UPDATED instead of duplicated.
  const { data: existingContractor, error: lookupError } = await supabase
    .from('contractor_profiles')
    .select('id')
    .ilike('email', escapeIlikePattern(data.email.trim().toLowerCase()))
    .maybeSingle();

  if (lookupError) {
    console.warn('[contractorService] contractor_profiles lookup warning:', lookupError.message);
  }

  // The contractor_profiles write is the authoritative save of this
  // registration (resume_url + experience_years + verification_status all live
  // on this row). Unlike the cosmetic profiles update above, a failure here is
  // FATAL — it must surface a clear error to the contractor.
  const cleanupUploadedResume = async () => {
    if (resumePath) {
      await supabase.storage
        .from('contractor-resumes')
        .remove([resumePath])
        .catch(() => {});
    }
  };

  if (existingContractor) {
    const { error: contractorErr } = await supabase
      .from('contractor_profiles')
      .update(contractorProfileRow)
      .eq('id', existingContractor.id);

    if (contractorErr) {
      await cleanupUploadedResume();
      throw new Error(`Failed to save contractor profile: ${contractorErr.message}`);
    }
  } else {
    // PHASE 1 IDENTITY: contractor_profiles.id IS the auth user id (the table
    // has NO user_id column). The signup trigger normally pre-creates this row
    // with id = auth.uid(); if it is missing (legacy account created before the
    // trigger existed), insert it with the authenticated user's id so that
    // contractor_profiles.id === profiles.id === auth.users.id is guaranteed.
    const { error: contractorErr } = await supabase
      .from('contractor_profiles')
      .insert({ ...contractorProfileRow, id: userId });

    if (contractorErr) {
      await cleanupUploadedResume();
      throw new Error(`Failed to save contractor profile: ${contractorErr.message}`);
    }
  }

  if (onProgress) onProgress(100);

  return {
    success: true,
    resumeUrl: resumeUrl ?? undefined,
    message: 'Registration submitted successfully. Your profile is pending admin verification.',
  };
}

/**
 * Fetch contractors filtered by verification_status from the LIVE
 * `contractor_profiles` table ('PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED').
 * Used by AdminDashboard. All profile data (full_name, email, phone, location,
 * skills, experience_years, project_types, resume_url) lives on the same row,
 * and `id` is the contractor identifier — no user_id join exists in the live
 * database.
 */
export async function getContractorsByStatus(
  status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED'
): Promise<any[]> {
  // Load every row with the live-column query (single source of truth, error
  // surfaces to the admin instead of becoming a silent empty list), then
  // filter client-side with case-insensitive normalization. NULL/empty and
  // lowercase 'pending' count as PENDING so existing registrations never
  // vanish from the Pending tab.
  const all = await getAllContractorProfiles();

  const target =
    status === 'VERIFIED' || status === 'APPROVED' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';

  return all.filter((row: any) => normalizeVerificationStatus(row.verification_status) === target);
}

/**
 * Update a contractor's verification status (ADMIN action) on the LIVE
 * `contractor_profiles` table. `contractorId` is contractor_profiles.id —
 * the same identifier stored in projects.contractor_id.
 */
export async function updateContractorVerification(
  contractorId: string,
  status: 'VERIFIED' | 'REJECTED' | 'PENDING' | 'APPROVED',
  rejectionReason?: string
): Promise<void> {
  // 'APPROVED' is a legacy alias → canonical 'VERIFIED'.
  const dbStatus = status === 'APPROVED' ? 'VERIFIED' : status;

  const updates: Record<string, any> = {
    verification_status: dbStatus,
  };

  const { error } = await supabase
    .from('contractor_profiles')
    .update(updates)
    .eq('id', contractorId);

  if (error) {
    console.error('[contractorService] updateContractorVerification failed:', error.message);
    throw new Error(`Verification update failed: ${error.message}${rejectionReason ? ` — ${rejectionReason}` : ''}`);
  }
}

/**
 * Generate a secure 1-hour signed URL for viewing/downloading a contractor's resume.
 */
export async function getSignedResumeUrl(resumePathOrUrl: string): Promise<string> {
  if (!resumePathOrUrl) {
    throw new Error('No resume file path provided.');
  }

  // If it's already a full HTTP URL, check if we need to sign a path
  if (resumePathOrUrl.startsWith('http://') || resumePathOrUrl.startsWith('https://')) {
    // Extract storage path if it's from contractor-resumes bucket
    const match = resumePathOrUrl.match(/\/contractor-resumes\/(.+)$/);
    if (match && match[1]) {
      const storagePath = decodeURIComponent(match[1]);
      const { data, error } = await supabase.storage
        .from('contractor-resumes')
        .createSignedUrl(storagePath, 3600); // 1 hour validity

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
    return resumePathOrUrl;
  }

  // Generate signed URL from storage path
  const { data, error } = await supabase.storage
    .from('contractor-resumes')
    .createSignedUrl(resumePathOrUrl, 3600);

  if (error || !data?.signedUrl) {
    console.warn('[contractorService] getSignedResumeUrl failed, falling back to public URL:', error?.message);
    const { data: publicData } = supabase.storage
      .from('contractor-resumes')
      .getPublicUrl(resumePathOrUrl);
    return publicData.publicUrl;
  }

  return data.signedUrl;
}

/**
 * Fetch previous/completed projects for a contractor (for admin verification).
 * Looks up projects where contractor_id = contractorUserId.
 * NOTE: projects table has no progress column, so it is not selected.
 */
export async function getPreviousProjectsForContractor(contractorUserId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, budget, budget_min, budget_max, city, state, start_date, updated_at')
    .eq('contractor_id', contractorUserId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('[contractorService] getPreviousProjectsForContractor failed:', error.message);
    return [];
  }

  return data ?? [];
}