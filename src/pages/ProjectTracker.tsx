import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, CheckCircle2, Circle, Flag, Plus, Trash2, RefreshCw,
  Loader2, TrendingUp, ClipboardList, Activity, Camera, Image as ImageIcon, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProjectMilestone } from '../types';
import { Project, ConstructionPhoto } from '../types/project';
import { Milestone } from '../mockData';
import {
  getMilestonesByProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from '../services/milestoneService';
import { getProjectsByContractor, getProjectsByCustomer } from '../services/projectService';
import {
  getConstructionPhotos,
  uploadConstructionPhoto,
  deleteConstructionPhoto,
} from '../services/constructionPhotoService';

/**
 * PHASE 7 — REAL Project Tracker.
 *
 * Milestones come straight from Supabase (public.project_milestones) for the
 * selected project — this view NEVER falls back to mock milestones.
 *
 * Authorization (mirrors the RLS in
 * supabase/migrations/20260908140000_phase7_milestone_tracker_schema.sql):
 *  - CUSTOMER (project owner): read-only schedule + progress view.
 *  - CONTRACTOR (assigned to the project): can create milestones, adjust
 *    progress / status / dates and delete them. RLS enforces the same rule
 *    server-side, so the UI controls are only a convenience.
 *
 * When no projectId is passed, the first project the user can access is
 * auto-selected and a selector is shown when there are several.
 */

const STATUS = (s: string | null | undefined): string => (s ?? '').toUpperCase();

const isCompleted = (m: ProjectMilestone): boolean =>
  STATUS(m.status) === 'COMPLETED' || Number(m.progress ?? 0) >= 100 || !!m.completed_date;

const isStarted = (m: ProjectMilestone): boolean =>
  STATUS(m.status) === 'IN_PROGRESS' ||
  STATUS(m.status) === 'ACTIVE' ||
  STATUS(m.status) === 'STARTED' ||
  Number(m.progress ?? 0) > 0;

/** Sort key: start_date (or created_at) as an ISO string — safe lexicographic compare. */
const sortKey = (m: ProjectMilestone): string => m.start_date || m.created_at;
/** Update key: updated_at (auto-bumped by the DB trigger) or created_at. */
const updateKey = (m: ProjectMilestone): string => m.updated_at || m.created_at;
/** Expected end key: Phase-7 expected_end_date or legacy due_date. */
const endKey = (m: ProjectMilestone): string | null => m.expected_end_date || m.due_date;

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const nowIso = (): string => new Date().toISOString();

const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
};

interface ProjectTrackerProps {
  /** The REAL project UUID whose milestones should be shown (from App state). */
  projectId?: string | null;
  /** Milestone list passed from App state (mockData Milestone type). */
  milestones: Milestone[];
  /** Setter to update the milestone list in App state. */
  onUpdateMilestone: React.Dispatch<React.SetStateAction<Milestone[]>>;
}

interface TrackerStats {
  overallProgress: number;
  total: number;
  completed: number;
  active: ProjectMilestone | null;
  upcoming: ProjectMilestone | null;
  expectedCompletion: string | null;
  latest: ProjectMilestone | null;
}

export const ProjectTracker: React.FC<ProjectTrackerProps> = ({
  projectId,
  // Props accepted for interface compatibility; internal data comes from Supabase.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  milestones: _milestones,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdateMilestone: _onUpdateMilestone,
}) => {
  const { user, profile } = useAuth();
  const isContractor = profile?.role === 'CONTRACTOR';

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    start_date: '',
    expected_end_date: '',
  });

  // ---- Phase 8: construction photos -----------------------------------------
  const [photos, setPhotos] = useState<ConstructionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    caption: '',
    milestoneId: '',
  });
  const [previewPhoto, setPreviewPhoto] = useState<ConstructionPhoto | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  // ---- data loading ---------------------------------------------------------

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    try {
      const rows = isContractor
        ? await getProjectsByContractor(user.id)
        : await getProjectsByCustomer(user.id);
      setProjects(rows ?? []);
    } catch (err) {
      console.warn('[ProjectTracker] project list load failed:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [user, isContractor]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Honor the prop; auto-select the first accessible project otherwise.
  useEffect(() => {
    if (projectId && projects.some((p) => p.id === projectId)) {
      setSelectedId(projectId);
    } else if (!selectedId && projects.length > 0) {
      setSelectedId(projects[0].id);
    }
  }, [projectId, projects, selectedId]);

  const loadMilestones = useCallback(async (pid: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setMilestones(await getMilestonesByProject(pid));
    } catch (err) {
      console.warn('[ProjectTracker] milestone load failed:', err);
      setMilestones([]);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMilestones([]);
      return;
    }
    void loadMilestones(selectedId);
  }, [selectedId, loadMilestones]);

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    await loadMilestones(selectedId);
  }, [selectedId, loadMilestones]);

  // ---- Phase 8: construction photo handlers ---------------------------------

  const loadPhotos = useCallback(async (pid: string) => {
    setLoadingPhotos(true);
    setPhotoError(null);
    try {
      setPhotos(await getConstructionPhotos(pid));
    } catch (err) {
      console.warn('[ProjectTracker] photo load failed:', err);
      setPhotos([]);
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPhotos([]);
      return;
    }
    void loadPhotos(selectedId);
  }, [selectedId, loadPhotos]);

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const fileInput = (e.target as HTMLFormElement).elements.namedItem('photo-file') as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setPhotoError('Please select a photo to upload.');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Only image files are allowed.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Photo must be smaller than 10MB.');
      return;
    }

    setUploading(true);
    setPhotoError(null);
    setNotice(null);
    try {
      await uploadConstructionPhoto(selectedId, file, {
        caption: uploadForm.caption.trim() || null,
        milestoneId: uploadForm.milestoneId || null,
      });
      setUploadForm({ caption: '', milestoneId: '' });
      setShowUpload(false);
      await loadPhotos(selectedId);
      setNotice({ kind: 'ok', text: 'Progress photo uploaded successfully.' });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: ConstructionPhoto) => {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return;
    setNotice(null);
    try {
      await deleteConstructionPhoto(photo.id);
      if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
      await loadPhotos(photo.project_id);
      setNotice({ kind: 'ok', text: 'Photo deleted.' });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    }
  };

  // ---- derived tracker statistics ------------------------------------------

  const stats: TrackerStats = useMemo(() => {
    if (milestones.length === 0) {
      return {
        overallProgress: Number(selectedProject?.progress ?? 0),
        total: 0,
        completed: 0,
        active: null,
        upcoming: null,
        expectedCompletion: selectedProject?.timeline ?? null,
        latest: null,
      };
    }

    const ordered = [...milestones].sort((a, b) => {
      const ka = new Date(sortKey(a)).getTime();
      const kb = new Date(sortKey(b)).getTime();
      return (Number.isNaN(ka) ? 0 : ka) - (Number.isNaN(kb) ? 0 : kb);
    });

    const completed = milestones.filter(isCompleted);
    const active = ordered.find((m) => !isCompleted(m) && isStarted(m)) ?? null;
    const upcoming = active
      ? null
      : (ordered.find((m) => !isCompleted(m)) ?? null);

    const endDates = milestones
      .map(endKey)
      .filter((d): d is string => !!d)
      .sort();
    const latest = milestones.reduce((a, b) =>
      new Date(updateKey(b)).getTime() > new Date(updateKey(a)).getTime() ? b : a
    );

    return {
      overallProgress: Math.round(
        milestones.reduce((s, m) => s + Number(m.progress ?? 0), 0) / milestones.length
      ),
      total: milestones.length,
      completed: completed.length,
      active,
      upcoming,
      expectedCompletion:
        endDates.length > 0 ? endDates[endDates.length - 1] : selectedProject?.timeline ?? null,
      latest,
    };
  }, [milestones, selectedProject]);

// ---- contractor mutation handlers ---------------------------------------

  const handleProgressChange = (m: ProjectMilestone, value: number) => {
    const completed = value >= 100;
    setSaving(true);
    setNotice(null);
    updateMilestone(m.id, {
      progress: value,
      status: completed ? 'COMPLETED' : value > 0 ? 'IN_PROGRESS' : m.status,
      completed_date: completed ? nowIso() : null,
      completed_at: completed ? nowIso() : null,
    })
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: `Progress for "${m.title}" set to ${value}%.` });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };

  const handleMarkInProgress = (m: ProjectMilestone) => {
    setSaving(true);
    setNotice(null);
    updateMilestone(m.id, {
      status: 'IN_PROGRESS',
      start_date: m.start_date ?? todayIso(),
    })
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: `"${m.title}" marked as the active milestone.` });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };

  const handleComplete = (m: ProjectMilestone) => {
    setSaving(true);
    setNotice(null);
    updateMilestone(m.id, {
      status: 'COMPLETED',
      progress: 100,
      completed_date: nowIso(),
      completed_at: nowIso(),
    })
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: `"${m.title}" completed 🎉` });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };

  const handleReopen = (m: ProjectMilestone) => {
    setSaving(true);
    setNotice(null);
    updateMilestone(m.id, {
      status: 'IN_PROGRESS',
      completed_date: null,
      completed_at: null,
    })
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: `"${m.title}" re-opened.` });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };

  const handleDateChange = (
    m: ProjectMilestone,
    field: 'start_date' | 'expected_end_date',
    value: string
  ) => {
    setSaving(true);
    setNotice(null);
    updateMilestone(m.id, { [field]: value || null })
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: 'Milestone dates saved.' });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !addForm.title.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await createMilestone({
        project_id: selectedId,
        title: addForm.title.trim(),
        description: addForm.description.trim() || null,
        status: 'PENDING',
        progress: 0,
        start_date: addForm.start_date || null,
        expected_end_date: addForm.expected_end_date || null,
      });
      setAddForm({ title: '', description: '', start_date: '', expected_end_date: '' });
      setShowAdd(false);
      await refresh();
      setNotice({ kind: 'ok', text: 'Milestone added to the project plan.' });
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMilestone = (m: ProjectMilestone) => {
    if (!window.confirm(`Delete milestone "${m.title}"? This cannot be undone.`)) return;
    setSaving(true);
    setNotice(null);
    deleteMilestone(m.id)
      .then(async () => {
        await refresh();
        setNotice({ kind: 'ok', text: `Milestone "${m.title}" deleted.` });
      })
      .catch((err) =>
        setNotice({ kind: 'err', text: err instanceof Error ? err.message : String(err) })
      )
      .finally(() => setSaving(false));
  };
// ---- render ---------------------------------------------------------------

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Project Tracker</h1>
          <p className="text-neutral-500 font-light mt-1">
            {isContractor
              ? 'Plan and update the site schedule — progress, milestones and dates are saved to the database.'
              : 'Live milestone schedule for your build. The contractor updates this plan.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.length > 1 && (
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="px-3 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 bg-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => void refresh()}
            disabled={loading || !selectedId}
            className="px-4 py-2 border border-neutral-200 hover:border-neutral-400 bg-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          {isContractor && selectedId && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              disabled={saving}
              className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> {showAdd ? 'Close' : 'Add Milestone'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold border ${
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
              : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loadError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">
          Milestones could not be loaded — the phase 7 migration may not be applied. ({loadError})
        </div>
      )}

      {loadingProjects && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your projects…
        </div>
      )}

      {!loadingProjects && projects.length === 0 && !loading && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-10 shadow-premium text-center">
          <ClipboardList className="w-10 h-10 mx-auto text-neutral-300" />
          <h2 className="text-lg font-extrabold text-neutral-900 mt-3">No projects available</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {isContractor
              ? 'Projects assigned to you will appear here after a customer selects you.'
              : 'Create a project to start tracking milestones.'}
          </p>
        </div>
      )}
{selectedId && !loadingProjects && (
        <>
          {/* Summary — computed entirely from the real milestone rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                  Overall Progress
                </span>
                <TrendingUp className="w-4 h-4 text-terracotta" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 mt-2">
                {stats.overallProgress}%
              </div>
              <div className="w-full bg-neutral-50 h-2.5 rounded-full overflow-hidden border border-neutral-100 mt-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(Math.max(stats.overallProgress, 0), 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-400 font-medium mt-2">
                Average of active milestone progress
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Completed Milestones
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 mt-2 flex items-center gap-2">
                {stats.completed}
                <span className="text-sm font-bold text-neutral-400">/ {stats.total}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-[10px] text-neutral-400 font-medium mt-3">
                {stats.total === 0
                  ? 'No milestones defined yet.'
                  : stats.completed === stats.total
                    ? 'All milestones complete — handover ready.'
                    : `${stats.total - stats.completed} remaining.`}
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Active Milestone
              </span>
              {stats.active ? (
                <>
                  <h3 className="text-lg font-extrabold text-neutral-900 mt-2 leading-snug">
                    {stats.active.title}
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-medium mt-2">
                    Started {fmtDate(stats.active.start_date)} • {stats.active.progress ?? 0}% done
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-neutral-400 mt-2">
                  {stats.completed === stats.total && stats.total > 0 ? 'All complete 🎉' : 'Nothing active'}
                </p>
              )}
            </div>
          </div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Upcoming Milestone
              </span>
              {stats.upcoming ? (
                <>
                  <h3 className="text-lg font-extrabold text-neutral-900 mt-2 leading-snug">
                    {stats.upcoming.title}
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-medium mt-2">
                    Starts {fmtDate(stats.upcoming.start_date)} • Ends {fmtDate(endKey(stats.upcoming))}
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-neutral-400 mt-2">
                  {stats.total === 0 ? 'Plan your milestones.' : 'Next up after the active phase.'}
                </p>
              )}
            </div>

            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Expected Completion
              </span>
              <div className="text-2xl font-extrabold text-neutral-900 mt-2 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-neutral-400" />
                {fmtDate(stats.expectedCompletion)}
              </div>
              <p className="text-[10px] text-neutral-400 font-medium mt-3">
                Last milestone end date in this plan
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Latest Update
              </span>
              {stats.latest ? (
                <>
                  <h3 className="text-base font-extrabold text-neutral-900 mt-2 leading-snug">
                    {stats.latest.title}
                  </h3>
                  <p className="text-[10px] text-neutral-400 font-medium mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtDateTime(updateKey(stats.latest))}
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-neutral-400 mt-2">No updates yet.</p>
              )}
            </div>
          </div>
{/* Read-only hint for customers */}
          {!isContractor && milestones.length > 0 && (
            <div className="p-3 rounded-xl bg-terracotta-50 border border-terracotta-100 text-[11px] font-semibold text-terracotta-800">
              Read-only view — the assigned contractor maintains this schedule.
            </div>
          )}

          {/* Add milestone form (contractor only) */}
          {showAdd && isContractor && (
            <form
              onSubmit={(e) => void handleCreateMilestone(e)}
              className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4"
            >
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-terracotta" /> Add Milestone
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={addForm.title}
                    onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Foundation excavation"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Description</label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    placeholder="Scope of work for this phase…"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={addForm.start_date}
                    onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Expected End Date</label>
                  <input
                    type="date"
                    value={addForm.expected_end_date}
                    onChange={(e) => setAddForm((f) => ({ ...f, expected_end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-terracotta hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Save Milestone
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading milestones…
            </div>
          )}

          {!loading && !loadError && milestones.length === 0 && (
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-8 shadow-premium text-center">
              <ClipboardList className="w-10 h-10 mx-auto text-neutral-300" />
              <p className="text-sm font-bold text-neutral-700 mt-3">No milestones yet</p>
              <p className="text-xs text-neutral-400 mt-1">
                {isContractor
                  ? 'Add the first milestone to start tracking this build.'
                  : 'The contractor has not added milestones for this project yet.'}
              </p>
            </div>
          )}

          {/* Milestone list */}
          {!loading && milestones.length > 0 && (
            <div className="space-y-4">
              {milestones.map((m) => {
                const done = isCompleted(m);
                const active = !done && isStarted(m);
                const progress = Math.min(Math.max(Number(m.progress ?? 0), 0), 100);
                return (
                  <div
                    key={m.id}
                    className={`bg-white border rounded-3xl p-5 shadow-premium transition-all ${
                      active
                        ? 'border-terracotta/60'
                        : done
                          ? 'border-neutral-200/60'
                          : 'border-neutral-200/80'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {done ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : active ? (
                            <Activity className="w-5 h-5 text-terracotta shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-neutral-300 shrink-0" />
                          )}
                          <h3
                            className={`text-base font-extrabold text-neutral-900 ${
                              done ? 'line-through text-neutral-400' : ''
                            }`}
                          >
                            {m.title}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              done
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                : active
                                  ? 'text-terracotta bg-terracotta-50 border-terracotta-100'
                                  : 'text-neutral-400 bg-neutral-50 border-neutral-100'
                            }`}
                          >
                            {done ? 'Completed' : active ? 'Active' : 'Upcoming'}
                          </span>
                        </div>

                        {m.description && (
                          <p className="text-xs text-neutral-500 font-light mt-2 leading-relaxed max-w-xl">
                            {m.description}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Start: {fmtDate(m.start_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Flag className="w-3 h-3" /> Expected: {fmtDate(endKey(m))}
                          </span>
                          {m.completed_date && (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" /> Completed: {fmtDate(m.completed_date)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Updated: {fmtDateTime(updateKey(m))}
                          </span>
                        </div>
                      </div>
                  {/* Contractor controls */}
                      {isContractor && !saving && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {done ? (
                            <button
                              onClick={() => handleReopen(m)}
                              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 bg-white hover:border-amber-300 transition-all"
                            >
                              Reopen
                            </button>
                          ) : (
                            <>
                              {!active && (
                                <button
                                  onClick={() => handleMarkInProgress(m)}
                                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-terracotta/40 text-terracotta bg-terracotta-50 hover:bg-terracotta-100 transition-all"
                                >
                                  Mark Active
                                </button>
                              )}
                              <button
                                onClick={() => handleComplete(m)}
                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all"
                              >
                                Complete
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteMilestone(m)}
                            className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 transition-all"
                            title="Delete milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-neutral-50 h-2 rounded-full overflow-hidden border border-neutral-100 mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            done ? 'bg-emerald-500' : active ? 'bg-terracotta' : 'bg-neutral-300'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
{/* Contractor inline editors */}
                    {isContractor && (
                      <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-5 flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={progress}
                            disabled={saving}
                            onChange={(e) => handleProgressChange(m, Number(e.target.value))}
                            className="flex-1 accent-terracotta"
                          />
                          <span className="text-xs font-extrabold text-neutral-800 w-9 text-right">
                            {progress}%
                          </span>
                        </div>
                        <label className="sm:col-span-3 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase">
                          Start
                          <input
                            type="date"
                            value={m.start_date ?? ''}
                            disabled={saving}
                            onChange={(e) => handleDateChange(m, 'start_date', e.target.value)}
                            className="px-2 py-1.5 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 bg-white"
                          />
                        </label>
                        <label className="sm:col-span-4 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase">
                          Expected End
                          <input
                            type="date"
                            value={endKey(m) ?? ''}
                            disabled={saving}
                            onChange={(e) => handleDateChange(m, 'expected_end_date', e.target.value)}
                            className="px-2 py-1.5 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-700 bg-white"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---- Phase 8: Construction Photo Gallery ---- */}
      {selectedId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-terracotta" />
              Progress Photos
              {photos.length > 0 && (
                <span className="text-sm font-bold text-neutral-400">({photos.length})</span>
              )}
            </h2>
            {isContractor && (
              <button
                onClick={() => setShowUpload((v) => !v)}
                disabled={uploading}
                className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5" /> {showUpload ? 'Close' : 'Upload Photo'}
              </button>
            )}
          </div>

          {photoError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">
              {photoError}
            </div>
          )}

          {/* Upload form (contractor only) */}
          {showUpload && isContractor && (
            <form
              onSubmit={(e) => void handleUploadPhoto(e)}
              className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4"
            >
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-terracotta" /> Upload Progress Photo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">
                    Photo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="photo-file"
                    accept="image/*"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-terracotta-50 file:text-terracotta file:font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Caption</label>
                  <input
                    type="text"
                    value={uploadForm.caption}
                    onChange={(e) => setUploadForm((f) => ({ ...f, caption: e.target.value }))}
                    placeholder="e.g. Foundation excavation complete"
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">
                    Link to Milestone (optional)
                  </label>
                  <select
                    value={uploadForm.milestoneId}
                    onChange={(e) => setUploadForm((f) => ({ ...f, milestoneId: e.target.value }))}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 bg-white"
                  >
                    <option value="">— None —</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-terracotta hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          )}

          {loadingPhotos && (
            <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading photos…
            </div>
          )}

          {!loadingPhotos && photos.length === 0 && (
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-8 shadow-premium text-center">
              <ImageIcon className="w-10 h-10 mx-auto text-neutral-300" />
              <p className="text-sm font-bold text-neutral-700 mt-3">No progress photos yet</p>
              <p className="text-xs text-neutral-400 mt-1">
                {isContractor
                  ? 'Upload photos to document construction progress.'
                  : 'Photos uploaded by the contractor will appear here.'}
              </p>
            </div>
          )}

          {/* Photo grid */}
          {!loadingPhotos && photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-white border border-neutral-200/80 rounded-2xl overflow-hidden shadow-premium group"
                >
                  <div
                    className="aspect-video bg-neutral-100 cursor-pointer relative overflow-hidden"
                    onClick={() => setPreviewPhoto(photo)}
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.caption ?? 'Progress photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    {photo.caption && (
                      <p className="text-xs font-semibold text-neutral-700 line-clamp-2">
                        {photo.caption}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDateTime(photo.created_at)}
                      </span>
                      {isContractor && photo.contractor_id === user?.id && (
                        <button
                          onClick={() => void handleDeletePhoto(photo)}
                          className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                          title="Delete photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Photo preview modal */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
            >
              <div
                className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="absolute top-3 right-3 p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors z-10"
                >
                  <X className="w-5 h-5 text-neutral-700" />
                </button>
                <img
                  src={previewPhoto.image_url}
                  alt={previewPhoto.caption ?? 'Progress photo'}
                  className="max-h-[80vh] w-auto mx-auto"
                />
                <div className="p-4">
                  {previewPhoto.caption && (
                    <p className="text-sm font-semibold text-neutral-700">{previewPhoto.caption}</p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fmtDateTime(previewPhoto.created_at)}
                  </p>
                  {isContractor && previewPhoto.contractor_id === user?.id && (
                    <button
                      onClick={() => void handleDeletePhoto(previewPhoto)}
                      className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Photo
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
