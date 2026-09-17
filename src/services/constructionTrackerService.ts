import { supabase } from '../lib/supabase';

export interface ConstructionMilestone {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  start_date?: string | null;
  end_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_index?: number | null;
}

export interface ConstructionUpdate {
  id: string;
  project_id: string;
  milestone_id?: string | null;
  contractor_id?: string | null;
  title?: string | null;
  description?: string | null;
  body?: string | null;
  progress?: number | null;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProgressSubmission {
  projectId: string;
  milestoneId?: string;
  description: string;
  progress?: number;
  photos?: File[];
  title?: string;
}

export interface ProjectProgress {
  projectId: string;
  overallProgress: number;
  completedMilestones: number;
  totalMilestones: number;
  milestones: ConstructionMilestone[];
  updates: ConstructionUpdate[];
  latestUpdate: ConstructionUpdate | null;
}

const MILESTONE_NAMES = [
  'Foundation',
  'Structure',
  'Roofing',
  'Electrical & Plumbing',
  'Interior',
  'Finishing',
  'Completion',
];

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String((error as { message?: unknown }).message ?? 'Unknown error');
  }

  return String(error);
}

export class ConstructionTrackerService {
  /**
   * Get all milestones belonging to a project.
   */
  static async getMilestones(
    projectId: string
  ): Promise<ConstructionMilestone[]> {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to load milestones: ${error.message}`);
    }

    return (data ?? []) as ConstructionMilestone[];
  }

  /**
   * Get all progress updates for a project.
   */
  static async getUpdates(
    projectId: string
  ): Promise<ConstructionUpdate[]> {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    const { data, error } = await supabase
      .from('site_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load progress updates: ${error.message}`);
    }

    return (data ?? []) as ConstructionUpdate[];
  }

  /**
   * Get the complete project progress information.
   */
  static async getProjectProgress(
    projectId: string
  ): Promise<ProjectProgress> {
    const [milestones, updates] = await Promise.all([
      this.getMilestones(projectId),
      this.getUpdates(projectId),
    ]);

    const completedMilestones = milestones.filter(
      (milestone) =>
        milestone.status?.toUpperCase() === 'COMPLETED' ||
        Number(milestone.progress ?? 0) >= 100
    ).length;

    const milestoneProgress =
      milestones.length > 0
        ? milestones.reduce(
            (total, milestone) =>
              total + clampProgress(Number(milestone.progress ?? 0)),
            0
          ) / milestones.length
        : 0;

    const latestUpdate = updates.length > 0 ? updates[0] : null;

    return {
      projectId,
      overallProgress: clampProgress(milestoneProgress),
      completedMilestones,
      totalMilestones: milestones.length,
      milestones,
      updates,
      latestUpdate,
    };
  }

  /**
   * Create the default construction milestones for a project.
   *
   * This only creates milestones when the project currently has none.
   */
  static async initializeMilestones(
    projectId: string
  ): Promise<ConstructionMilestone[]> {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    const existing = await this.getMilestones(projectId);

    if (existing.length > 0) {
      return existing;
    }

    const rows = MILESTONE_NAMES.map((name, index) => ({
      project_id: projectId,
      title: name,
      description: `${name} construction stage`,
      status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
      progress: 0,
      order_index: index,
    }));

    const { data, error } = await supabase
      .from('project_milestones')
      .insert(rows)
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      throw new Error(`Failed to initialize milestones: ${error.message}`);
    }

    return (data ?? []) as ConstructionMilestone[];
  }

  /**
   * Update milestone progress.
   */
  static async updateMilestoneProgress(
    milestoneId: string,
    progress: number,
    status?: string
  ): Promise<ConstructionMilestone> {
    if (!milestoneId) {
      throw new Error('Milestone ID is required.');
    }

    const safeProgress = clampProgress(progress);

    const nextStatus =
      status ??
      (safeProgress >= 100
        ? 'COMPLETED'
        : safeProgress > 0
          ? 'IN_PROGRESS'
          : 'PENDING');

    const updateData: Record<string, unknown> = {
      progress: safeProgress,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (safeProgress >= 100) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .select('*')
      .single();

    if (error) {
      throw new Error(
        `Failed to update milestone: ${error.message}`
      );
    }

    return data as ConstructionMilestone;
  }

  /**
   * Submit a construction progress update.
   *
   * Photos are uploaded to the construction-progress storage bucket.
   * The database record is stored in site_logs.
   */
  static async submitProgress(
    submission: ProgressSubmission
  ): Promise<ConstructionUpdate> {
    const {
      projectId,
      milestoneId,
      description,
      progress,
      photos = [],
      title,
    } = submission;

    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    if (!description.trim()) {
      throw new Error('Please provide a construction update.');
    }

    const photoUrls: string[] = [];

    for (const photo of photos) {
      if (!photo) continue;

      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_');

      const filePath =
        `${projectId}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('construction-progress')
        .upload(filePath, photo, {
          upsert: false,
          contentType: photo.type || 'image/jpeg',
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload progress photo: ${uploadError.message}`
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from('construction-progress')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        photoUrls.push(publicUrlData.publicUrl);
      }
    }

    const row: Record<string, unknown> = {
      project_id: projectId,
      description: description.trim(),
      created_at: new Date().toISOString(),
    };

    if (milestoneId) {
      row.milestone_id = milestoneId;
    }

    if (title) {
      row.title = title.trim();
    }

    if (progress !== undefined) {
      row.progress = clampProgress(progress);
    }

    if (photoUrls.length > 0) {
      row.photo_urls = photoUrls;

      // Some versions of the table use photo_url for a single image.
      row.photo_url = photoUrls[0];
    }

    const { data, error } = await supabase
      .from('site_logs')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(
        `Failed to save construction update: ${error.message}`
      );
    }

    if (milestoneId && progress !== undefined) {
      await this.updateMilestoneProgress(milestoneId, progress);
    }

    return data as ConstructionUpdate;
  }

  /**
   * Add a progress update without photos.
   */
  static async addUpdate(
    projectId: string,
    description: string,
    milestoneId?: string,
    progress?: number
  ): Promise<ConstructionUpdate> {
    return this.submitProgress({
      projectId,
      milestoneId,
      description,
      progress,
      photos: [],
    });
  }

  /**
   * Get the latest progress update.
   */
  static async getLatestUpdate(
    projectId: string
  ): Promise<ConstructionUpdate | null> {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    const { data, error } = await supabase
      .from('site_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load latest update: ${error.message}`
      );
    }

    return data as ConstructionUpdate | null;
  }

  /**
   * Get updates created after a particular timestamp.
   *
   * This is the correct place for the previously corrupted
   * createdAt / loadedAt / latestUpdate logic.
   */
  static async getUpdatesSince(
    projectId: string,
    loadedAt: string
  ): Promise<ConstructionUpdate[]> {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }

    if (!loadedAt) {
      return this.getUpdates(projectId);
    }

    const { data, error } = await supabase
      .from('site_logs')
      .select('*')
      .eq('project_id', projectId)
      .gt('created_at', loadedAt)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(
        `Failed to load new updates: ${error.message}`
      );
    }

    return (data ?? []) as ConstructionUpdate[];
  }

  /**
   * Calculate progress directly from milestones.
   */
  static calculateOverallProgress(
    milestones: ConstructionMilestone[]
  ): number {
    if (milestones.length === 0) {
      return 0;
    }

    const total = milestones.reduce(
      (sum, milestone) =>
        sum + clampProgress(Number(milestone.progress ?? 0)),
      0
    );

    return clampProgress(total / milestones.length);
  }

  /**
   * Get a single milestone.
   */
  static async getMilestone(
    milestoneId: string
  ): Promise<ConstructionMilestone | null> {
    if (!milestoneId) {
      return null;
    }

    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('id', milestoneId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to load milestone: ${error.message}`
      );
    }

    return data as ConstructionMilestone | null;
  }

  /**
   * Delete a progress update.
   */
  static async deleteUpdate(updateId: string): Promise<void> {
    if (!updateId) {
      throw new Error('Update ID is required.');
    }

    const { error } = await supabase
      .from('site_logs')
      .delete()
      .eq('id', updateId);

    if (error) {
      throw new Error(
        `Failed to delete progress update: ${error.message}`
      );
    }
  }

  /**
   * Simple health check for the tracker service.
   */
  static async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('project_milestones')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error(
        '[ConstructionTrackerService] Connection check failed:',
        getErrorMessage(error)
      );

      return false;
    }
  }
}

export default ConstructionTrackerService;