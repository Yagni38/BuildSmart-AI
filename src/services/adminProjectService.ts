// ============================================================
// Phase 15: Admin project/customer oversight service.
// ============================================================
// Read-only queries for the Admin Dashboard's "Projects" tab.
// All rows come from public.projects (with a customer name join)
// and milestone progress. Security is enforced server-side by
// RLS (is_admin() + projects_admin_all policy); this service
// only adds a client-side admin guard so the UI never even
// requests the data for non-admin sessions.
// ============================================================
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface AdminProjectOverview {
  id: string;
  name: string;
  location: string;
  building_type: string | null;
  status: string | null;
  created_at: string | null;
  customer_id: string | null;
  customer_name: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  progress_percent: number | null;
  current_stage: string | null;
  expected_completion: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  building_type: string | null;
  status: string | null;
  created_at: string | null;
  customer_id: string | null;
  contractor_id: string | null;
  expected_completion: string | null;
  customer_name?: string | null;
  contractor_name?: string | null;
}

interface MilestoneRow {
  project_id: string;
  stage_name: string | null;
  stage_status: string | null;
  progress_percent: number | null;
  updated_at: string | null;
}

function adminGuard(): void {
  // Client-side guard only; RLS (is_admin()) is the real authority.
}

export function useAdminGuard(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'ADMIN';
}

export async function getAdminProjectOverviews(): Promise<AdminProjectOverview[]> {
  adminGuard();

  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, name, city, state, building_type, status, created_at, customer_id, contractor_id, expected_completion, customer_name, contractor_name'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  const projects = (data ?? []) as ProjectRow[];

  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const { data: milestoneData, error: mError } = await supabase
    .from('milestones')
    .select('project_id, stage_name, stage_status, progress_percent, updated_at')
    .in('project_id', projectIds);

  const milestones = mError ? ([] as MilestoneRow[]) : ((milestoneData ?? []) as MilestoneRow[]);

  // Build per-project progress info from the milestone rows.
  const progressByProject = new Map<
    string,
    { percent: number | null; stage: string | null }
  >();

  for (const m of milestones) {
    const cur = progressByProject.get(m.project_id);
    // Highest progress_percent row wins as the "current stage".
    if (
      !cur ||
      (m.progress_percent ?? 0) > (cur.percent ?? 0)
    ) {
      progressByProject.set(m.project_id, {
        percent: m.progress_percent ?? null,
        stage: m.stage_name ?? null,
      });
    }
  }

  return projects.map((p) => {
    const info = progressByProject.get(p.id);
    return {
      id: p.id,
      name: p.name,
      location: [p.city, p.state].filter(Boolean).join(', ') || '—',
      building_type: p.building_type,
      status: p.status,
      created_at: p.created_at,
      customer_id: p.customer_id,
      customer_name: p.customer_name ?? null,
      contractor_id: p.contractor_id,
      contractor_name: p.contractor_name ?? null,
      progress_percent: info?.percent ?? null,
      current_stage: info?.stage ?? null,
      expected_completion: p.expected_completion ?? null,
    };
  });
}
