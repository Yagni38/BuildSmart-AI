export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'completed';

export interface TrackerMilestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  progress: number;
  start_date?: string | null;
  end_date?: string | null;
  completed_at?: string | null;
}

export interface TrackerUpdate {
  id: string;
  project_id: string;
  milestone_id?: string | null;
  milestone?: string | null;
  body?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  created_at: string;
  created_by?: string | null;
}

export interface ProjectTracker {
  project_id: string;
  progress: number;
  current_milestone?: string | null;
  milestones: TrackerMilestone[];
  updates: TrackerUpdate[];
}

export interface ProgressSubmission {
  project_id: string;
  milestone_id?: string | null;
  milestone?: string | null;
  body: string;
  photo_urls?: string[];
}