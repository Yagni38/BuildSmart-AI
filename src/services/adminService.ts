import { supabase } from '../lib/supabase';

/**
 * Admin service (Phase 15) — admin-only operations for contractor verification,
 * project monitoring, and system oversight.
 *
 * DATABASE SCHEMA:
 * - contractors table: id, profile_id, verification_status, rejection_reason, etc.
 * - profiles table: id, full_name, email, phone, etc.
 * - Relationship: contractors.profile_id = profiles.id
 *
 * RLS note: These functions assume the caller is an admin. The frontend
 * AdminAccessGate component enforces admin-only access.
 */

const PROFILES_TABLE = 'profiles';
const CONTRACTORS_TABLE = 'contractors';

function formatDbError(action: string, error: { message: string; code?: string }): string {
  const code = error.code ? ` [${error.code}]` : '';
  return `${action}: ${error.message}${code}`;
}

// ---------------------------------------------------------------------------
// Contractor Applications
// ---------------------------------------------------------------------------

/**
 * Fetch contractors by verification_status from the contractors table.
 * Joins with profiles to get profile information (full_name, email, phone, etc.)
 */
export async function getContractorsByStatus(
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'APPROVED'
): Promise<any[]> {
  // Map the admin tab status to the actual database status values
  const dbStatus = status === 'VERIFIED' ? 'APPROVED' : status;
  
  const { data, error } = await supabase
    .from(CONTRACTORS_TABLE)
    .select(`
      id,
      profile_id,
      verification_status,
      rejection_reason,
      experience_years,
      skills,
      project_types,
      specialty,
      location,
      created_at,
      updated_at,
      profiles:profile_id (
        id,
        full_name,
        email,
        phone,
        city,
        state
      )
    `)
    .eq('verification_status', dbStatus)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[adminService] getContractorsByStatus failed:', error.message);
    throw new Error(formatDbError('Failed to load contractor applications', error));
  }

  // Flatten the nested profiles data for easier consumption
  return (data ?? []).map((row: any) => ({
    id: row.id,
    profile_id: row.profile_id,
    verification_status: row.verification_status,
    rejection_reason: row.rejection_reason,
    experience_years: row.experience_years,
    skills: row.skills,
    project_types: row.project_types,
    specialty: row.specialty,
    location: row.location,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Profile fields (flattened from nested relation)
    full_name: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? null,
    phone: row.profiles?.phone ?? null,
    city: row.profiles?.city ?? null,
    state: row.profiles?.state ?? null,
  }));
}

/**
 * Approve a contractor - updates contractor_profiles.verification_status to 'VERIFIED'
 * (legacy 'APPROVED' alias is written for backward compatibility).
 */
export async function approveContractor(
  contractorId: string,
  adminNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('contractor_profiles')
    .update({
      verification_status: 'VERIFIED',
    })
    .eq('id', contractorId);

  if (error) {
    console.error('[adminService] approveContractor failed:', error.message);
    throw new Error(formatDbError('Failed to approve contractor', error));
  }
}

/**
 * Reject a contractor - updates contractor_profiles.verification_status to 'REJECTED'
 */
export async function rejectContractor(
  contractorId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from('contractor_profiles')
    .update({
      verification_status: 'REJECTED',
    })
    .eq('id', contractorId);

  if (error) {
    console.error('[adminService] rejectContractor failed:', error.message);
    throw new Error(formatDbError('Failed to reject contractor', error));
  }
}

// ---------------------------------------------------------------------------
// Project Monitoring
// ---------------------------------------------------------------------------

/**
 * Fetch projects for admin monitoring.
 * NOTE: The live projects table does NOT have progress / start_date columns.
 * Progress is tracked via project_milestones / site_logs.
 */
export async function getProjectsForAdmin(status?: string): Promise<any[]> {
  let query = supabase
    .from('projects')
    .select(`
      id, name, status, budget, budget_min, budget_max,
      city, state, customer_id, contractor_id,
      created_at, updated_at
    `)
    .order('created_at', { ascending: false });

  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    // Admin ACTIVE tab passes 'IN_PROGRESS,ACTIVE_BUILD,CONTRACTOR_SELECTED':
    // CONTRACTOR_SELECTED (written by assignContractorToProject) MUST stay in
    // the ACTIVE set or newly assigned projects disappear from the dashboard.
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('status', statuses);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[adminService] getProjectsForAdmin failed:', error.message);
    throw new Error(formatDbError('Failed to load projects', error));
  }

  return data ?? [];
}

/**
 * Fetch the most recent construction updates for the admin monitoring feed.
 * Reads the LIVE public.site_logs table (id, project_id, contractor_id,
 * milestone_id, description, image_url, created_at) joined to the project name.
 */
export async function getRecentConstructionUpdates(limit = 50): Promise<any[]> {
  const { data, error } = await supabase
    .from('site_logs')
    .select(`
      id, project_id, description, image_url,
      created_at, projects!inner(name),
      contractors(company_name, owner_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[adminService] getRecentConstructionUpdates failed:', error.message);
    throw new Error(formatDbError('Failed to load construction updates', error));
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    update_type: row.image_url ? 'IMAGE' : 'SITE',
    title: null,
    content: row.description ?? null,
    project_name: row.projects?.name ?? null,
    contractor_name:
      row.contractors?.company_name ?? row.contractors?.owner_name ?? null,
  }));
}

/**
 * Fetch customer-contractor assignments for monitoring.
 */
export async function getCustomerContractorAssignments(): Promise<any[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, name, status,
      customer_id, contractor_id
    `)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[adminService] getCustomerContractorAssignments failed:', error.message);
    throw new Error(formatDbError('Failed to load assignments', error));
  }

  return data ?? [];
}

export async function getActiveProjectsForWeatherMonitoring(): Promise<any[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, city, state, status')
    .in('status', ['IN_PROGRESS', 'ACTIVE_BUILD', 'CONTRACTOR_SELECTED'])
    .not('city', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[adminService] getActiveProjectsForWeatherMonitoring failed:', error.message);
    throw new Error(formatDbError('Failed to load projects for weather monitoring', error));
  }

  return data ?? [];
}

/** Alias for getProjectsForAdmin — fetches all projects (active + completed). */
export async function getAllProjects(status?: string): Promise<any[]> {
  return getProjectsForAdmin(status);
}

/** Alias for getRecentConstructionUpdates — fetches recent updates for admin monitoring. */
export async function getProjectUpdatesForAdmin(limit = 50): Promise<any[]> {
  return getRecentConstructionUpdates(limit);
}

// ---------------------------------------------------------------------------
// Admin Statistics
// ---------------------------------------------------------------------------

export async function getAdminStatistics(): Promise<{
  totalContractors: number;
  pendingApplications: number;
  approvedContractors: number;
  rejectedContractors: number;
  activeProjects: number;
  completedProjects: number;
  totalProjects: number;
}> {
  const [
    { count: totalContractors },
    { count: pendingApplications },
    { count: approvedContractors },
    { count: rejectedContractors },
    { count: activeProjects },
    { count: completedProjects },
    { count: totalProjects },
  ] = await Promise.all([
    supabase.from(CONTRACTORS_TABLE).select('*', { count: 'exact', head: true }),
    supabase.from(CONTRACTORS_TABLE).select('*', { count: 'exact', head: true }).eq('verification_status', 'PENDING'),
    supabase.from(CONTRACTORS_TABLE).select('*', { count: 'exact', head: true }).eq('verification_status', 'APPROVED'),
    supabase.from(CONTRACTORS_TABLE).select('*', { count: 'exact', head: true }).eq('verification_status', 'REJECTED'),
    supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', ['IN_PROGRESS', 'ACTIVE_BUILD', 'CONTRACTOR_SELECTED']),
    supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', ['COMPLETED', 'COMPLETE']),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
  ]);

  return {
    totalContractors: totalContractors ?? 0,
    pendingApplications: pendingApplications ?? 0,
    approvedContractors: approvedContractors ?? 0,
    rejectedContractors: rejectedContractors ?? 0,
    activeProjects: activeProjects ?? 0,
    completedProjects: completedProjects ?? 0,
    totalProjects: totalProjects ?? 0,
  };
}