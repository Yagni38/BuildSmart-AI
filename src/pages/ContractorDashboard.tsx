import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building, DollarSign, MapPin, Camera, RefreshCw, ArrowLeft,
  ClipboardList, Send, Upload, Loader2, CheckCircle2, Circle, Clock, ShieldCheck, XCircle,
  Activity, Trash2, CloudSun, CloudRain, MessageSquare, FileText, Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Project, ProjectUpdate, ProjectUpdateType, ConstructionPhoto } from '../types/project';
import { ProjectMilestone } from '../types';
import {
  getAssignedProjects,
  getCustomerNames,
  getProjectUpdates,
  addProjectUpdate,
  applyProgressToMilestones,
  getMilestoneProgress,
  uploadSiteImage,
  setMilestoneStatus,
  updateTypeLabel,
} from '../services/contractorDashboardService';
import {
  getMilestonesByProject,
  initializeProjectStages,
  SUGGESTED_CONSTRUCTION_STAGES,
  updateMilestone,
} from '../services/milestoneService';
import { getConstructionPhotos, uploadConstructionPhoto, deleteConstructionPhoto } from '../services/constructionPhotoService';
import { getWeatherRisk } from '../services/weatherService';
import { WeatherRiskCard } from '../components/WeatherRiskCard';
import type { WeatherRiskResult } from '../types/weather';
import { estimateMaterialCost } from '../lib/materialRates';
import { getMaterials } from '../services/materialService';
import { getMessagesByProject, sendMessage, subscribeToProjectMessages } from '../services/messageService';
import { getProjectReport, formatBudget, ProjectReport } from '../services/reportService';

/**
 * PHASE 6 — REAL Contractor Dashboard.
 *
 * Every row shown comes from Supabase for the authenticated contractor:
 * projects.contractor_id = auth.uid() (enforced by RLS). Contractors can
 * update progress, milestones and post site updates + photos on their OWN
 * assigned projects only. Customers can read these updates but can never
 * modify them (RLS: project_updates / project_milestones write policies).
 */

const fmtBudget = (p: Project): string => {
  const amount = p.budget ?? p.budget_max ?? p.budget_min;
  if (amount == null) return 'Budget TBD';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
};

const fmtLocation = (p: Project): string =>
  [p.city, p.state].filter(Boolean).join(', ') || 'Location TBD';

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
};

const statusBadge = (status: string): string => {
  switch (String(status).toUpperCase()) {
    case 'COMPLETED':
      return 'text-emerald-700 bg-emerald-50 border-emerald-100';
    case 'IN_PROGRESS':
    case 'ACTIVE_BUILD':
    case 'CONTRACTOR_SELECTED':
      return 'text-blue-700 bg-blue-50 border-blue-100';
    case 'CANCELLED':
      return 'text-red-700 bg-red-50 border-red-100';
    default:
      return 'text-amber-700 bg-amber-50 border-amber-100';
  }
};

export const ContractorDashboard: React.FC = () => {
  const { user, profile } = useAuth();

  // ---- assigned projects + customer names --------------------------------
  const [projects, setProjects] = useState<Project[]>([]);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  // Progress is DERIVED from project_milestones (the live projects table has no
  // progress column) — keyed by project id, 0-100.
  const [progressByProject, setProgressByProject] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- selected project detail -------------------------------------------
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ---- progress form -------------------------------------------------------
  const [progressValue, setProgressValue] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);

  // ---- update post form ----------------------------------------------------
  const [updateType, setUpdateType] = useState<ProjectUpdateType>('SITE');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [formMessage, setFormMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // ---- daily progress update form (Phase 9) ---------------------------------
  const [dailyUpdateText, setDailyUpdateText] = useState('');
  const [dailyUpdateStage, setDailyUpdateStage] = useState<string>('');
  const [dailyUpdateProgress, setDailyUpdateProgress] = useState<number>(0);
  const [dailyUpdatePhotos, setDailyUpdatePhotos] = useState<File[]>([]);
  const [postingDailyUpdate, setPostingDailyUpdate] = useState(false);

  // ---- construction photos (Phase 9) ----------------------------------------
  const [constructionPhotos, setConstructionPhotos] = useState<ConstructionPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ---- stage initialization (Phase 9) ---------------------------------------
  const [initializingStages, setInitializingStages] = useState(false);
  const [stageMessage, setStageMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // ---- chat state --------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // ---- weather state -----------------------------------------------------
  const [weatherResult, setWeatherResult] = useState<WeatherRiskResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // ---- material estimate state -------------------------------------------
  const [materialEstimate, setMaterialEstimate] = useState<any>(null);
  const [dbMaterials, setDbMaterials] = useState<any[]>([]);
  const [materialLoading, setMaterialLoading] = useState(false);

  // ---- report state ------------------------------------------------------
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId]
  );

  /** Load assigned projects (RLS: only projects.contractor_id = auth.uid()). */
  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await getAssignedProjects();
      setProjects(rows);
      // Average/real progress comes from project_milestones.
      setProgressByProject(await getMilestoneProgress(rows.map((r) => r.id)));
      const names = await getCustomerNames(rows.map((r) => r.customer_id));
      setCustomerNames(names);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  /** Load milestones + updates for the selected project. */
  const loadProjectDetail = useCallback(async (projectId: string) => {
    setDetailLoading(true);
    setFormMessage(null);
    try {
      const [ms, us] = await Promise.all([
        getMilestonesByProject(projectId).catch(() => [] as ProjectMilestone[]),
        getProjectUpdates(projectId).catch(() => [] as ProjectUpdate[]),
      ]);
      setMilestones(ms);
      setUpdates(us);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMilestones([]);
      setUpdates([]);
      return;
    }
    void loadProjectDetail(selectedId);
  }, [selectedId, loadProjectDetail]);

  useEffect(() => {
    setProgressValue(selectedProject?.progress ?? 0);
  }, [selectedProject]);

  // ---- handlers ------------------------------------------------------------

  const handleSaveProgress = async () => {
    if (!selectedProject) return;
    setSavingProgress(true);
    try {
      // Progress lives in project_milestones — the slider distributes the target
      // percentage across this project's milestones (no projects.progress column).
      await applyProgressToMilestones(selectedProject.id, progressValue);
      await addProjectUpdate({
        project_id: selectedProject.id,
        update_type: 'PROGRESS',
        title: 'Progress Update',
        content: `Progress set to ${progressValue}%.`,
      });
      await loadProjectDetail(selectedProject.id);
      const refreshed = await getMilestoneProgress([selectedProject.id]);
      setProgressByProject((prev) => ({ ...prev, ...refreshed }));
      setFormMessage({ kind: 'ok', text: `Milestone progress updated to ${progressValue}%.` });
    } catch (err) {
      setFormMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingProgress(false);
    }
  };

  const handleToggleMilestone = async (m: ProjectMilestone) => {
    if (!selectedProject) return;
    const nextStatus = String(m.status).toUpperCase() === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await setMilestoneStatus(m.id, nextStatus);
      await addProjectUpdate({
        project_id: selectedProject.id,
        update_type: 'MILESTONE',
        title: m.title,
        content:
          nextStatus === 'COMPLETED'
            ? `Milestone "${m.title}" marked COMPLETED.`
            : `Milestone "${m.title}" re-opened (${nextStatus}).`,
      });
      await loadProjectDetail(selectedProject.id);
      setFormMessage({ kind: 'ok', text: `Milestone "${m.title}" → ${nextStatus}.` });
    } catch (err) {
      setFormMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!updateContent.trim() && !imageFile) {
      setFormMessage({ kind: 'err', text: 'Write an update or attach a photo first.' });
      return;
    }

    setPostingUpdate(true);
    setFormMessage(null);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadSiteImage(selectedProject.id, imageFile);
      }

      await addProjectUpdate({
        project_id: selectedProject.id,
        update_type: imageFile ? 'IMAGE' : updateType,
        title: updateTitle.trim() || updateTypeLabel(updateType),
        content: updateContent.trim() || null,
        image_url: imageUrl,
      });

      setUpdateTitle('');
      setUpdateContent('');
      setImageFile(null);
      await loadProjectDetail(selectedProject.id);
      setFormMessage({ kind: 'ok', text: 'Update posted successfully.' });
    } catch (err) {
      setFormMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPostingUpdate(false);
    }
  };

  // ---- Phase 9 handlers ----------------------------------------------------

  /** Load construction photos for the selected project. */
  const loadConstructionPhotos = useCallback(async (projectId: string) => {
    setLoadingPhotos(true);
    setPhotoError(null);
    try {
      const photos = await getConstructionPhotos(projectId);
      setConstructionPhotos(photos);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
      setConstructionPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  /** Initialize suggested construction stages for the selected project. */
  const handleInitializeStages = async () => {
    if (!selectedProject) return;
    setInitializingStages(true);
    setStageMessage(null);
    try {
      const created = await initializeProjectStages(selectedProject.id);
      if (created.length > 0) {
        setStageMessage({ kind: 'ok', text: `Created ${created.length} construction stages.` });
        await loadProjectDetail(selectedProject.id);
      } else {
        setStageMessage({ kind: 'ok', text: 'Stages already exist for this project.' });
      }
    } catch (err) {
      setStageMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInitializingStages(false);
    }
  };

  /** Post a daily progress update with optional photos. */
  const handlePostDailyUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !dailyUpdateText.trim()) return;

    setPostingDailyUpdate(true);
    setFormMessage(null);

    try {
      // 1. Create the progress update entry
      await addProjectUpdate({
        project_id: selectedProject.id,
        update_type: 'PROGRESS',
        title: dailyUpdateStage || 'Daily Progress Update',
        content: dailyUpdateText.trim(),
      });

      // 2. Upload photos if any
      if (dailyUpdatePhotos.length > 0) {
        for (const photo of dailyUpdatePhotos) {
          try {
            await uploadConstructionPhoto(selectedProject.id, photo, {
              caption: dailyUpdateText.trim().slice(0, 100),
            });
          } catch (photoErr) {
            console.warn('[ContractorDashboard] Photo upload failed:', photoErr);
          }
        }
      }

      // 3. Update stage progress if a stage is selected
      if (dailyUpdateStage) {
        const stage = milestones.find((m) => m.title === dailyUpdateStage);
        if (stage) {
          await updateMilestone(stage.id, {
            progress: dailyUpdateProgress,
            status: dailyUpdateProgress >= 100 ? 'COMPLETED' : dailyUpdateProgress > 0 ? 'IN_PROGRESS' : 'PENDING',
            ...(dailyUpdateProgress >= 100 && { completed_date: new Date().toISOString() }),
          });
        }
      }

      // 4. Reload data
      await loadProjectDetail(selectedProject.id);
      await loadConstructionPhotos(selectedProject.id);

      // 5. Reset form
      setDailyUpdateText('');
      setDailyUpdateStage('');
      setDailyUpdateProgress(0);
      setDailyUpdatePhotos([]);
      setFormMessage({ kind: 'ok', text: 'Daily progress update posted successfully.' });
    } catch (err) {
      setFormMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPostingDailyUpdate(false);
    }
  };

  /** Delete a construction photo. */
  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedProject) return;
    try {
      await deleteConstructionPhoto(photoId);
      await loadConstructionPhotos(selectedProject.id);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    }
  };

  // ---- Phase 14 handlers: weather, materials, chat, report -------------------

  /** Load weather outlook for the selected project's location. */
  const loadWeather = useCallback(async (projectId: string) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const result = await getWeatherRisk(projectId);
      setWeatherResult(result);
      if (!result.success) {
        setWeatherError(result.error || 'Weather outlook unavailable for this location.');
      }
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : String(err));
      setWeatherResult(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  /** Load material estimate for the selected project. */
  const loadMaterialEstimate = useCallback(async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setMaterialLoading(true);
    try {
      // Get DB materials first (Phase 11)
      const dbMats = await getMaterials(projectId).catch(() => [] as any[]);
      setDbMaterials(dbMats);

      // Calculate preliminary estimate from project data
      const estimate = estimateMaterialCost({
        built_up_area: project.built_up_area ?? project.plot_size ?? 1200,
        floors: project.floors ?? 1,
        bedrooms: project.bedrooms ?? 2,
        bathrooms: project.bathrooms ?? 2,
        project_type: (project.building_type ?? project.project_type) as any,
        city: project.city,
        state: project.state,
      });
      setMaterialEstimate(estimate);
    } catch (err) {
      console.warn('[ContractorDashboard] Material estimate failed:', err);
      setMaterialEstimate(null);
    } finally {
      setMaterialLoading(false);
    }
  }, [projects]);

  /** Load chat messages for the selected project. */
  const loadChatMessages = useCallback(async (projectId: string) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const msgs = await getMessagesByProject(projectId);
      setChatMessages(msgs);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  /** Send a chat message to the customer. */
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !chatInput.trim() || !user) return;
    setChatSending(true);
    setChatError(null);
    try {
      await sendMessage({
        project_id: selectedProject.id,
        sender_id: user.id,
        receiver_id: selectedProject.customer_id,
        message: chatInput.trim(),
        attachment_url: null,
      });
      setChatInput('');
      await loadChatMessages(selectedProject.id);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatSending(false);
    }
  };

  /** Load project report. */
  const loadReportData = useCallback(async (projectId: string) => {
    setReportLoading(true);
    setReportError(null);
    try {
      const r = await getProjectReport(projectId);
      setReport(r);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, []);

  /** Load weather, materials, chat, and report when selected project changes. */
  useEffect(() => {
    if (selectedId) {
      void loadWeather(selectedId);
      void loadMaterialEstimate(selectedId);
      void loadChatMessages(selectedId);
      void loadReportData(selectedId);
    } else {
      setWeatherResult(null);
      setMaterialEstimate(null);
      setDbMaterials([]);
      setChatMessages([]);
      setReport(null);
    }
  }, [selectedId, loadWeather, loadMaterialEstimate, loadChatMessages, loadReportData]);

  /** Subscribe to realtime chat messages. */
  useEffect(() => {
    if (!selectedId || !user) return;
    const unsubscribe = subscribeToProjectMessages(
      selectedId,
      (msg) => setChatMessages((prev) => [...prev, msg]),
      (msg) => setChatMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m))),
      (msgId) => setChatMessages((prev) => prev.filter((m) => m.id !== msgId)),
    );
    return unsubscribe;
  }, [selectedId, user]);

  /** Load construction photos when selected project changes. */
  useEffect(() => {
    if (selectedId) {
      void loadConstructionPhotos(selectedId);
    } else {
      setConstructionPhotos([]);
    }
  }, [selectedId, loadConstructionPhotos]);

  // ---- render ---------------------------------------------------------------

  const activeCount = projects.filter((p) =>
    ['IN_PROGRESS', 'ACTIVE_BUILD', 'CONTRACTOR_SELECTED'].includes(String(p.status).toUpperCase())
  ).length;

  const totalBudget = projects.reduce(
    (sum, p) => sum + Number(p.budget ?? p.budget_max ?? p.budget_min ?? 0),
    0
  );

  // Average progress across the assigned projects that actually have milestones
  // (real project_milestones data — never a projects.progress column).
  const projectsWithProgress = projects.filter((p) => progressByProject[p.id] != null);
  const averageProgress =
    projectsWithProgress.length > 0
      ? Math.round(
          projectsWithProgress.reduce(
            (sum, p) => sum + (progressByProject[p.id] ?? 0),
            0
          ) / projectsWithProgress.length
        )
      : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Phase 3 — verification banner from the database */}
      {(profile?.verification_status === 'VERIFIED' || profile?.verification_status === 'APPROVED') && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-semibold text-emerald-800">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>
            Verified contractor — you are in the verified pool and eligible for customer recommendations.
          </span>
        </div>
      )}
      {profile?.verification_status === 'REJECTED' && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-semibold text-red-700">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span>
            Verification rejected{profile?.rejection_reason ? `: ${profile.rejection_reason}` : '. Contact support for details.'}
          </span>
        </div>
      )}
      {(!profile?.verification_status || profile.verification_status === 'PENDING') && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-semibold text-amber-800">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>Verification pending — an administrator is reviewing your application.</span>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Contractor Workspace</h1>
          <p className="text-neutral-500 font-light mt-1">
            Managing <strong className="font-semibold text-neutral-700">
              {activeCount} Active {activeCount === 1 ? 'Site' : 'Sites'}
            </strong>
            {' '}• Welcome back, {profile?.full_name || profile?.company_name || 'Contractor'}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadProjects()}
            disabled={loading}
            className="px-4 py-2 border border-neutral-200 hover:border-neutral-400 bg-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <span className="text-xs text-neutral-400 font-bold">
            {projects.length} Assigned {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>
      </div>

      {/* Analytics cards — real counts from Supabase */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Assigned Projects</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">{projects.length}</div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">{activeCount} actively in build</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Total Contract Value</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">
            ₹{totalBudget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-neutral-500 font-semibold mt-1">Across all assigned sites</p>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Average Progress</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">
            {averageProgress == null ? '—' : `${averageProgress}%`}
          </div>
          <p className="text-[10px] text-neutral-400 font-medium mt-1">
            Derived from project milestones
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your assigned projects…
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700 font-semibold">
          {loadError}
        </div>
      )}

      {!loading && !loadError && projects.length === 0 && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-10 shadow-premium text-center">
          <Building className="w-10 h-10 mx-auto text-neutral-300" />
          <h2 className="text-lg font-extrabold text-neutral-900 mt-3">No assigned projects yet</h2>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            When a customer selects you for their project, it will appear here with live progress,
            milestones and site updates.
          </p>
        </div>
      )}

      {/* Project list */}
      {!loading && !loadError && projects.length > 0 && !selectedProject && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="text-left bg-white border border-neutral-200/80 hover:border-terracotta/60 rounded-3xl p-6 shadow-premium transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-extrabold text-neutral-900 leading-snug">{p.name}</h3>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge(String(p.status))}`}>
                  {String(p.status).replace(/_/g, ' ')}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-neutral-600 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-neutral-400" />
                  {customerNames[p.customer_id] || p.customer_id.slice(0, 8) + '…'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" /> {fmtLocation(p)}
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-neutral-400" /> {fmtBudget(p)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" /> Expected:{' '}
                  {p.expected_completion ? fmtDate(p.expected_completion) : p.timeline || '—'}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                  <span>Progress</span>
                  <span>{progressByProject[p.id] ?? 0}%</span>
                </div>
                <div className="w-full bg-neutral-50 h-2 rounded-full overflow-hidden border border-neutral-100 mt-1">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(progressByProject[p.id] ?? 0, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-2">
                  Last updated: {fmtDateTime(p.updated_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Project details */}
      {selectedProject && (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to all projects
          </button>

          {/* Header card */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-neutral-900">{selectedProject.name}</h2>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-neutral-400" />
                    Customer: {customerNames[selectedProject.customer_id] || selectedProject.customer_id.slice(0, 8) + '…'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" /> {fmtLocation(selectedProject)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-neutral-400" /> {fmtBudget(selectedProject)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" /> Expected:{' '}
                    {selectedProject.expected_completion
                      ? fmtDate(selectedProject.expected_completion)
                      : selectedProject.timeline || '—'}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded border ${statusBadge(String(selectedProject.status))}`}>
                {String(selectedProject.status).replace(/_/g, ' ')}
              </span>
            </div>

            {/* Progress update */}
            <div className="mt-6 pt-5 border-t border-neutral-100">
              <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wide">
                <span>Project Progress</span>
                <span>
                  {progressByProject[selectedProject.id] ?? 0}% • Derived from milestones (updated{' '}
                  {fmtDateTime(selectedProject.updated_at)})
                </span>
              </div>
              <div className="w-full bg-neutral-50 h-2.5 rounded-full overflow-hidden border border-neutral-100 mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(progressByProject[selectedProject.id] ?? 0, 100)}%`,
                  }}
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progressValue}
                  onChange={(e) => setProgressValue(Number(e.target.value))}
                  className="flex-1 accent-terracotta"
                />
                <span className="text-sm font-extrabold text-neutral-900 w-12 text-center">{progressValue}%</span>
                <button
                  onClick={() => void handleSaveProgress()}
                  disabled={savingProgress}
                  className="px-5 py-2 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {savingProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Save Progress
                </button>
              </div>
            </div>

            {selectedProject.description && (
              <p className="mt-5 text-sm text-neutral-600 leading-relaxed">{selectedProject.description}</p>
            )}

            {/* Real project details — live public.projects columns only. */}
            <dl className="mt-5 pt-5 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {[
                { label: 'Building Type', value: selectedProject.building_type },
                { label: 'Project Type', value: selectedProject.project_type },
                {
                  label: 'Built-up Area',
                  value:
                    selectedProject.built_up_area != null
                      ? `${selectedProject.built_up_area} sq.ft`
                      : null,
                },
                { label: 'Floors', value: selectedProject.floors },
                { label: 'Bedrooms', value: selectedProject.bedrooms },
                { label: 'Bathrooms', value: selectedProject.bathrooms },
                { label: 'Construction Stage', value: selectedProject.construction_stage },
                { label: 'Design Style', value: selectedProject.design_style },
                { label: 'Material Preference', value: selectedProject.material_preference },
                { label: 'Sustainability', value: selectedProject.sustainability_preference },
                {
                  label: 'Expected Completion',
                  value: selectedProject.expected_completion
                    ? fmtDate(selectedProject.expected_completion)
                    : selectedProject.timeline,
                },
                { label: 'Budget', value: fmtBudget(selectedProject) },
                {
                  label: 'Priority',
                  value: selectedProject.priority,
                },
                {
                  label: 'Location',
                  value: fmtLocation(selectedProject),
                },
              ]
                .filter((row) => row.value != null && String(row.value).trim() !== '')
                .map((row) => (
                  <div key={row.label} className="space-y-0.5">
                    <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                      {row.label}
                    </dt>
                    <dd className="font-semibold text-neutral-800">{String(row.value)}</dd>
                  </div>
                ))}

              {selectedProject.requirements && (
                <div className="col-span-2 sm:col-span-3 space-y-0.5">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
                    Requirements
                  </dt>
                  <dd className="font-semibold text-neutral-700 leading-relaxed whitespace-pre-line">
                    {selectedProject.requirements}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {formMessage && (
            <div
              className={`p-4 rounded-2xl text-sm font-semibold border ${
                formMessage.kind === 'ok'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border-red-100 text-red-700'
              }`}
            >
              {formMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left column: post update + milestones */}
            <div className="lg:col-span-7 space-y-6">
              {/* Post update */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
                  <Camera className="w-5 h-5 text-terracotta" /> Post Project Update
                </h3>

                <form onSubmit={handlePostUpdate} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Update Type</label>
                      <select
                        value={updateType}
                        onChange={(e) => setUpdateType(e.target.value as ProjectUpdateType)}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 bg-white"
                      >
                        <option value="SITE">Site Update</option>
                        <option value="PROGRESS">Progress Update</option>
                        <option value="MILESTONE">Milestone Update</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Title (optional)</label>
                      <input
                        type="text"
                        value={updateTitle}
                        onChange={(e) => setUpdateTitle(e.target.value)}
                        placeholder="e.g. Roof slab shuttering"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Update Details</label>
                    <textarea
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                      rows={3}
                      placeholder="Describe concrete casting, steel layout, electrical conduit progress, rain delays…"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 focus:outline-none focus:border-terracotta"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <label className="px-3.5 py-2 border border-neutral-200 hover:border-neutral-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer">
                      <Upload className="w-4 h-4 text-neutral-400" />
                      {imageFile ? imageFile.name.slice(0, 24) : 'Attach Site Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={postingUpdate}
                      className="px-6 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                    >
                      {postingUpdate ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Post Update
                    </button>
                  </div>
                </form>
              </div>

              {/* Milestones */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-3">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
                  <ClipboardList className="w-5 h-5 text-terracotta" /> Milestones
                </h3>

                {detailLoading && (
                  <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading milestones…
                  </p>
                )}

                {!detailLoading && milestones.length === 0 && (
                  <p className="text-xs text-neutral-400 font-semibold py-2">
                    No milestones defined for this project yet.
                  </p>
                )}

                {milestones.map((m) => {
                  const done = String(m.status).toUpperCase() === 'COMPLETED';
                  return (
                    <div
                      key={m.id}
                      className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className={`font-bold text-sm ${done ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>
                          {m.title}
                        </h4>
                        <span className="text-[10px] text-neutral-400">
                          {m.due_date ? `Due ${fmtDate(m.due_date)}` : 'No due date'}
                          {m.completed_at ? ` • Completed ${fmtDate(m.completed_at)}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => void handleToggleMilestone(m)}
                        className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${
                          done
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                            : 'text-neutral-500 bg-white border-neutral-200 hover:border-emerald-300'
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        {done ? 'Completed' : 'Mark Done'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {milestones.length === 0 && !detailLoading && (
                <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                  <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
                    <ClipboardList className="w-5 h-5 text-terracotta" /> Construction Stages
                  </h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Initialize the project with suggested construction stages to start tracking daily progress.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_CONSTRUCTION_STAGES.map((stage) => (
                      <span key={stage} className="px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg text-[10px] font-semibold text-neutral-600">
                        {stage}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => void handleInitializeStages()}
                    disabled={initializingStages}
                    className="px-5 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {initializingStages ? (<Loader2 className="w-3.5 h-3.5 animate-spin" />) : (<ClipboardList className="w-3.5 h-3.5" />)}
                    {initializingStages ? 'Creating Stages…' : 'Initialize Construction Stages'}
                  </button>
                  {stageMessage && (
                    <p className={`text-xs font-semibold ${stageMessage.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{stageMessage.text}</p>
                  )}
                </div>
              )}

              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
                  <Activity className="w-5 h-5 text-terracotta" /> Daily Progress Update
                </h3>
                <form onSubmit={handlePostDailyUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">
                      Progress Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={dailyUpdateText}
                      onChange={(e) => setDailyUpdateText(e.target.value)}
                      placeholder="Describe today's construction progress"
                      rows={3}
                      required
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 placeholder:text-neutral-400 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Stage</label>
                      <select value={dailyUpdateStage} onChange={(e) => setDailyUpdateStage(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 bg-white">
                        <option value="">— Select Stage —</option>
                        {milestones.map((m) => (<option key={m.id} value={m.title}>{m.title}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Stage Progress: {dailyUpdateProgress}%</label>
                      <input type="range" min={0} max={100} value={dailyUpdateProgress} onChange={(e) => setDailyUpdateProgress(Number(e.target.value))} className="w-full accent-terracotta" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Photos (optional)</label>
                    <input type="file" accept="image/*" multiple onChange={(e) => setDailyUpdatePhotos(Array.from(e.target.files ?? []))} className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-terracotta-50 file:text-terracotta file:font-bold" />
                    {dailyUpdatePhotos.length > 0 && (<p className="text-[10px] text-neutral-500 mt-1">{dailyUpdatePhotos.length} photo(s) selected</p>)}
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={postingDailyUpdate || !dailyUpdateText.trim()} className="px-6 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50">
                      {postingDailyUpdate ? (<Loader2 className="w-3.5 h-3.5 animate-spin" />) : (<Send className="w-3.5 h-3.5" />)}
                      Post Daily Update
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5">
                  <Camera className="w-5 h-5 text-terracotta" /> Progress Photos
                  {constructionPhotos.length > 0 && (<span className="text-sm font-bold text-neutral-400">({constructionPhotos.length})</span>)}
                </h3>
                {photoError && (<div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">{photoError}</div>)}
                {loadingPhotos && (<div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold"><Loader2 className="w-4 h-4 animate-spin" /> Loading photos…</div>)}
                {!loadingPhotos && constructionPhotos.length === 0 && (<p className="text-xs text-neutral-400 font-semibold py-2">No progress photos yet. Upload photos using the daily update form.</p>)}
                {!loadingPhotos && constructionPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {constructionPhotos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-neutral-100">
                        <img src={photo.image_url} alt={photo.caption ?? 'Progress photo'} className="w-full h-24 object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <button onClick={() => void handleDeletePhoto(photo.id)} className="p-1.5 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors" title="Delete photo">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                        {photo.caption && (<p className="text-[9px] text-neutral-500 px-1.5 py-1 truncate">{photo.caption}</p>)}
                        <p className="text-[8px] text-neutral-400 px-1.5 pb-1">{fmtDateTime(photo.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: weather, materials, chat, report */}
            <div className="lg:col-span-5 space-y-6">
              {/* Weather */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudSun className="w-4 h-4 text-terracotta" /> Weather Outlook
                </h3>
                {weatherLoading && (
                  <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading weather…
                  </p>
                )}
                {weatherError && !weatherLoading && (
                  <p className="text-xs text-neutral-500 font-semibold">{weatherError}</p>
                )}
                {!weatherLoading && weatherResult && weatherResult.success && weatherResult.data && (
                  <WeatherRiskCard result={weatherResult} city={weatherResult.data.location?.city || selectedProject?.city || ''} state={weatherResult.data.location?.state ?? selectedProject?.state ?? null} />
                )}
              </div>

              {/* Material Estimate */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-terracotta" /> Material Estimate
                </h3>
                {materialLoading && (
                  <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculating estimate…
                  </p>
                )}
                {!materialLoading && materialEstimate && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-neutral-500">Total Material Cost</span>
                      <span className="text-neutral-900">₹{materialEstimate.totalMaterialCost?.toLocaleString('en-IN') ?? '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-neutral-500">Estimated Budget</span>
                      <span className="text-neutral-900">₹{materialEstimate.estimatedProjectBudget?.toLocaleString('en-IN') ?? '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-neutral-500">Location Multiplier</span>
                      <span className="text-neutral-700">×{materialEstimate.location?.multiplier?.toFixed(2) ?? '1.00'}</span>
                    </div>
                    {materialEstimate.categories && materialEstimate.categories.length > 0 && (
                      <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                        {materialEstimate.categories.map((cat: any) => (
                          <div key={cat.category} className="flex justify-between text-[11px]">
                            <span className="text-neutral-500 capitalize">{cat.label}</span>
                            <span className="font-semibold text-neutral-700">₹{cat.subtotal?.toLocaleString('en-IN') ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {dbMaterials.length > 0 && (
                      <div className="pt-2 border-t border-neutral-100">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Stored Materials ({dbMaterials.length})</p>
                        <div className="space-y-1">
                          {dbMaterials.slice(0, 5).map((m: any) => (
                            <div key={m.id} className="flex justify-between text-[11px]">
                              <span className="text-neutral-600">{m.name}</span>
                              <span className="font-semibold text-neutral-700">₹{(m.estimated_cost ?? 0).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                          {dbMaterials.length > 5 && (
                            <p className="text-[10px] text-neutral-400">+{dbMaterials.length - 5} more items</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!materialLoading && !materialEstimate && !selectedProject?.city && (
                  <p className="text-xs text-neutral-400 font-semibold">Set project city to see material estimate.</p>
                )}
              </div>

              {/* Customer Chat */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-terracotta" /> Customer Chat
                </h3>
                {chatLoading && (
                  <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading messages…
                  </p>
                )}
                {chatError && !chatLoading && (
                  <p className="text-xs text-red-600 font-semibold">{chatError}</p>
                )}
                {!chatLoading && (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {chatMessages.length === 0 && (
                        <p className="text-xs text-neutral-400 font-semibold py-2">No messages yet. Start the conversation.</p>
                      )}
                      {chatMessages.map((msg: any) => {
                        const isMe = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                              isMe ? 'bg-terracotta text-white' : 'bg-neutral-100 text-neutral-800'
                            }`}>
                              <p className="font-semibold leading-relaxed">{msg.message}</p>
                              <p className={`text-[9px] mt-1 ${isMe ? 'text-white/70' : 'text-neutral-400'}`}>
                                {fmtDateTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-neutral-100">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Message customer..."
                        className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-terracotta"
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        className="p-2 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl disabled:opacity-50 transition-all"
                      >
                        {chatSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </form>
                  </>
                )}
              </div>
              {/* Project Report */}
              <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-3">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-terracotta" /> Project Report
                </h3>
                {reportLoading && (
                  <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating report…
                  </p>
                )}
                {reportError && !reportLoading && (
                  <p className="text-xs text-red-600 font-semibold">{reportError}</p>
                )}
                {!reportLoading && report && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-neutral-500">Stage</span>
                      <span className="text-neutral-800">{report.currentStage ?? '—'}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-neutral-500">Milestones</span>
                      <span className="text-neutral-800">{report.milestones.length}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-neutral-500">Completed</span>
                      <span className="text-emerald-700">{report.milestones.filter((m) => (m.status ?? '').toUpperCase() === 'COMPLETED').length}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-neutral-500">Updates</span>
                      <span className="text-neutral-800">{report.updates.length}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-neutral-500">Photos</span>
                      <span className="text-neutral-800">{report.photos.length}</span>
                    </div>
                    {report.budgetSummary && (
                      <div className="pt-2 border-t border-neutral-100 space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-neutral-500">Budget</span>
                          <span className="text-neutral-800">{formatBudget(report.budgetSummary.totalBudget)}</span>
                        </div>
                        {report.budgetSummary.materialCostEstimate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Materials</span>
                            <span className="text-neutral-600">{formatBudget(report.budgetSummary.materialCostEstimate)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-neutral-400 pt-1">
                      Latest activity: {report.latestActivity ? fmtDateTime(report.latestActivity) : '—'}
                    </p>
                  </div>
                )}
              </div>

              {detailLoading && (
                <p className="text-xs text-neutral-400 font-semibold flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading updates…
                </p>
              )}

              {!detailLoading && updates.length === 0 && (
                <p className="text-xs text-neutral-400 font-semibold py-2">No updates posted yet.</p>
              )}

              <div className="space-y-3">
                {updates.map((u) => (
                  <div key={u.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold text-terracotta uppercase tracking-wide">
                        {updateTypeLabel(u.update_type)}
                      </span>
                      <span className="text-[10px] text-neutral-400">{fmtDateTime(u.created_at)}</span>
                    </div>
                    {u.title && <h4 className="font-bold text-xs text-neutral-800">{u.title}</h4>}
                    {u.content && <p className="text-xs text-neutral-600 leading-relaxed">{u.content}</p>}
                    {u.image_url && (
                      <img
                        src={u.image_url}
                        alt={u.title || 'Site photo'}
                        className="rounded-lg border border-neutral-100 max-h-44 w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
