import { supabase } from '../lib/supabase';
import { Profile } from '../types';

/**
 * Profile service — CRUD operations for the `profiles` table.
 *
 * Phase 14 safety: users may update their OWN allowed profile fields only.
 * `role` and `verification_status` are STRIPPED from every update so they can
 * never be changed through this service — role changes and verification are
 * controlled exclusively by the admin workflow (AdminDashboard / RLS).
 */

/**
 * Fields a user is allowed to update about themselves.
 * Deliberately EXCLUDES: role, verification_status, rejection_reason,
 * email (read-only identity), created_at / updated_at (server-managed).
 *
 * PHASE 1: contractor professional fields (location, skills,
 * years_of_experience, project_types, company_name, description) are ALSO
 * excluded — the LIVE public.profiles table has NO such columns, so sending
 * them caused PGRST204 ("could not find the column") crashes. They are edited
 * through contractorService.updateOwnContractorProfile() against the LIVE
 * public.contractor_profiles table (experience_years — no
 * years_of_experience column exists there either).
 */
export interface UpdateProfileData {
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  avatar_url?: string | null;
}

/** Keys that are NEVER allowed through updateProfile — defense in depth. */
const FORBIDDEN_KEYS: string[] = [
  'id',
  'role',
  'verification_status',
  'rejection_reason',
  'email',
  'created_at',
  'updated_at',
  'resume_path',
  'resume_url',
  // PHASE 1: contractor-only fields — no such columns on public.profiles.
  'location',
  'skills',
  'years_of_experience',
  'experience_years',
  'project_types',
  'company_name',
  'description',
];

function stripForbiddenKeys(payload: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!FORBIDDEN_KEYS.includes(key)) clean[key] = value;
  }
  return clean;
}

export async function getProfileById(profileId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', profileId).single();
  if (error) {
    console.error('[profileService] getProfileById failed:', error.message);
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }
  return data as Profile | null;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('email', email).single();
  if (error) {
    console.error('[profileService] getProfileByEmail failed:', error.message);
    throw new Error(`Failed to fetch profile by email: ${error.message}`);
  }
  return data as Profile | null;
}

export async function createProfile(profile: Omit<Profile, 'created_at' | 'updated_at'>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles').insert(profile).select().single();
  if (error) {
    console.error('[profileService] createProfile failed:', error.message);
    throw new Error(`Failed to create profile: ${error.message}`);
  }
  return data as Profile;
}

/**
 * Update an existing profile record — SAFE version.
 * Strips forbidden keys (role, verification_status, email, ...) so callers can
 * never accidentally (or intentionally) escalate privileges through this service.
 */
export async function updateProfile(
  profileId: string,
  updates: UpdateProfileData
): Promise<Profile> {
  const safePayload = stripForbiddenKeys(updates as Record<string, unknown>);
  if (Object.keys(safePayload).length === 0) {
    throw new Error('No updatable profile fields were provided.');
  }
  const { data, error } = await supabase
    .from('profiles').update(safePayload).eq('id', profileId).select().single();
  if (error) {
    console.error('[profileService] updateProfile failed:', error.message);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
  return data as Profile;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles').delete().eq('id', profileId);
  if (error) {
    console.error('[profileService] deleteProfile failed:', error.message);
    throw new Error(`Failed to delete profile: ${error.message}`);
  }
}