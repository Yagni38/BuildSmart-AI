import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, Building, MapPin, Layers, Calendar, FileText,
  AlertCircle, CheckCircle, RefreshCw, Save, Sparkles,
  Download, ExternalLink, Image as ImageIcon, DollarSign, Clock, Lightbulb, Loader2,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { getProjectById, updateProject } from '../services/projectService';
import { saveEstimateToProject } from '../services/estimateService';
import { estimateMaterialCost } from '../lib/materialRates';
import { useAuth } from '../context/AuthContext';
import { LOCAL_PLAN_MODEL, planMatchesProject } from '../lib/projectPlan';
import {
  generateAIDesign,
  fetchAIDesigns,
  getAIImageSignedUrl,
} from '../services/aiDesignService';
import {
  generateAndSaveProjectPlan,
  getLatestProjectPlan,
} from '../services/aiProjectPlanService';
import { ContractorRecommendations } from '../components/ContractorRecommendations';
import type { Project, UpdateProjectData, ProjectStatus } from '../types/project';
import type { AIDesign } from '../types/aiDesign';
import type { SavedAIProjectPlan } from '../types/aiDesign';
import {
  projectStatusLabel, projectTypeLabel, formatDate, inrInLakhs,
} from '../lib/projectUtils';

interface ProjectDetailsProps {
  projectId?: string | null;
  onBack: () => void;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ projectId: propProjectId, onBack }) => {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId ?? paramProjectId ?? null;
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // AI Design state
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIDesign | null>(null);

  const [aiImage, setAiImage] = useState<{ url: string | null; prompt: string }>({
    url: null,
    prompt: '',
  });
  const [aiImageLoading, setAiImageLoading] = useState<boolean>(false);

  // Phase 2 - AI Project Plan state
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedAIProjectPlan | null>(null);

  const projectRequirements = useMemo(() => {
    if (!project) return [];
    const items: Array<{ label: string; value: string }> = [
      { label: 'Location', value: [project.city, project.state].filter(Boolean).join(', ') || 'Not specified' },
      { label: 'Full Address', value: project.full_address || 'Not specified' },
      { label: 'Plot Size', value: project.plot_size != null ? `${project.plot_size} sq.ft` : 'Not specified' },
      { label: 'Built-up Area', value: project.built_up_area != null ? `${project.built_up_area} sq.ft` : 'Not specified' },
      { label: 'Budget', value: project.budget != null ? `₹${Number(project.budget).toLocaleString('en-IN')}` : 'Not specified' },
      { label: 'Floors', value: project.floors != null ? String(project.floors) : 'Not specified' },
      { label: 'Bedrooms', value: project.bedrooms != null ? String(project.bedrooms) : 'Not specified' },
      { label: 'Bathrooms', value: project.bathrooms != null ? String(project.bathrooms) : 'Not specified' },
      { label: 'Preferred Materials', value: project.preferred_materials || 'Not specified' },
      { label: 'Architectural Style', value: project.design_style || 'Not specified' },
      { label: 'Sustainability', value: project.priority || 'Not specified' },
      { label: 'Expected Completion', value: project.timeline ? formatDate(project.timeline) : 'Not specified' },
      { label: 'Description', value: project.description || 'Not specified' },
      { label: 'Requirements', value: project.requirements || 'Not specified' },
    ];
    return items;
  }, [project]);

  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!projectId) {
      setError('No project selected. Please open a project from your dashboard.');
      setLoading(false);
      return;
    }
    try {
      const found = await getProjectById(projectId);
      if (found) {
        setProject(found);
      } else {
        setProject(null);
        setError('Project not found. It may have been deleted, or it is not visible to this account.');
      }
    } catch (err) {
      setProject(null);
      setError(`Could not load project: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadExistingDesign = useCallback(async () => {
    if (!projectId) return;
    setAiImageLoading(true);
    try {
      const designs = await fetchAIDesigns(projectId);
      const latest = designs.find((d: AIDesign) => d.image_path) ?? designs[0];
      if (latest?.image_path) {
        const signedUrl = await getAIImageSignedUrl(latest.image_path);
        if (signedUrl) {
          setAiImage({ url: signedUrl, prompt: latest.prompt ?? '' });
        }
      }
    } catch (err) {
      console.warn('[ProjectDetails] Could not restore saved AI design image:', err);
    } finally {
      setAiImageLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) loadExistingDesign();
  }, [loadExistingDesign]);

  // Phase 2 - AI Project Plan: restore previously generated plan
  const loadExistingPlan = useCallback(async () => {
    if (!projectId) return;
    try {
      const plan = await getLatestProjectPlan(projectId);
      setSavedPlan(plan);
    } catch (err) {
      console.warn('[ProjectDetails] Could not restore saved AI project plan:', err);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) loadExistingPlan();
  }, [loadExistingPlan]);

  // The plan is generated deterministically in the browser (no Edge Function,
  // no network), so it can be built the moment the project loads — and
  // auto-refreshed whenever the saved plan is stale relative to the project
  // (e.g., the customer edited floors/rooms or selected a different project).
  const planAutoTriedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!project || planLoading) return;
    if (planAutoTriedRef.current) return;
    // Not the owner (e.g., an admin preview): never auto-generate.
    if (!user || project.customer_id !== user.id) {
      planAutoTriedRef.current = true;
      return;
    }
    // A saved plan that still matches the current project is shown as-is.
    if (savedPlan && planMatchesProject(project, savedPlan)) {
      planAutoTriedRef.current = true;
      return;
    }
    planAutoTriedRef.current = true;
    void handleGeneratePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, savedPlan, planLoading, user]);

  const handleGeneratePlan = async () => {
    if (!projectId) {
      setPlanError('No project ID - cannot generate AI project plan.');
      return;
    }
    if (!project) {
      setPlanError('Project details are not loaded yet.');
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    try {
      const saved = await generateAndSaveProjectPlan(project);
      setSavedPlan(saved);
    } catch (err) {
      console.error('[ProjectDetails] AI project plan generation error:', err);
      setPlanError(err instanceof Error ? err.message : 'Failed to generate AI project plan. Please try again.');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!projectId) {
      setAiError('No project ID - cannot generate AI design.');
      return;
    }
    if (!project) {
      setAiError('Project details are not loaded yet.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await generateAIDesign(project);
      if (!result.success) {
        setAiError(result.error || 'AI design generation failed.');
        return;
      }
      if (result.design) setAiResult(result.design);
      if (result.imageUrl) {
        setAiImage({ url: result.imageUrl, prompt: result.imagePrompt ?? '' });
      } else if (result.image) {
        setAiImage({ url: result.image, prompt: result.imagePrompt ?? '' });
      }
    } catch (err) {
      console.error('[ProjectDetails] AI generation error:', err);
      setAiError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setAiLoading(false);
    }
  };

  const beginEdit = () => {
    if (!project) return;
    setForm({
      name: stringify(project.name),
      building_type: stringify(project.building_type),
      full_address: stringify(project.full_address),
      city: stringify(project.city),
      state: stringify(project.state),
      plot_size: stringify(project.plot_size),
      built_up_area: stringify(project.built_up_area),
      floors: stringify(project.floors),
      bedrooms: stringify(project.bedrooms),
      bathrooms: stringify(project.bathrooms),
      preferred_materials: stringify(project.preferred_materials),
      budget: stringify(project.budget),
      construction_stage: stringify(project.construction_stage),
      description: stringify(project.description),
      requirements: stringify(project.requirements),
      status: project.status,
    });
    setEditing(true);
    setEditError(null);
    setEditSuccess(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditError(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setSaving(true);
    setEditError(null);
    setEditSuccess(null);
    const updates: UpdateProjectData = {
      name: form.name.trim(),
      building_type: form.building_type?.trim() || undefined,
      full_address: form.full_address?.trim() || null,
      city: form.city?.trim() || undefined,
      state: form.state?.trim() || undefined,
      plot_size: toNumber(form.plot_size),
      built_up_area: toNumber(form.built_up_area),
      floors: toNumber(form.floors),
      bedrooms: toNumber(form.bedrooms),
      bathrooms: toNumber(form.bathrooms),
      preferred_materials: form.preferred_materials?.trim() || null,
      budget: toNumber(form.budget),
      construction_stage: form.construction_stage || undefined,
      description: form.description?.trim() || null,
      requirements: form.requirements?.trim() || null,
      status: form.status as ProjectStatus,
    };
    try {
      const updated = await updateProject(projectId, updates);
      setProject(updated);
      if (updated.city !== project?.city || updated.state !== project?.state) {
        try {
          await saveEstimateToProject(projectId, estimateMaterialCost(updated));
        } catch (err) {
          setEditError(`Project location saved, but estimates could not be refreshed. Retry using Materials → Refresh estimates from saved project location. ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
      setEditing(false);
      setEditSuccess('Project updated successfully.');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-6 px-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      {loading && (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta mx-auto mb-3"></div>
          <p className="text-sm text-neutral-500">Loading project...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button onClick={onBack} className="mt-3 px-5 py-2.5 border border-neutral-200 text-neutral-600 text-xs font-bold rounded-xl">Back to Dashboard</button>
        </div>
      )}

      {!loading && !error && project && (
        <>

          {/* Header card */}
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
                <Building className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-neutral-950">{project.name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1 text-neutral-400 font-mono">ID: {project.id}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-terracotta" />
                    {[project.city, project.state].filter(Boolean).join(', ') || '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-terracotta" /> Created {formatDate(project.created_at)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 uppercase">
                    {projectStatusLabel(project.status)}
                  </span>
                </div>
              </div>
            </div>
            {!editing && (
              <button onClick={beginEdit} className="px-5 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl transition-all shadow-premium hover:shadow-premium-hover">
                Edit Project
              </button>
            )}
          </div>

          {editError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" /> {editError}
            </div>
          )}

          {editing ? (
            <div className="bg-white border border-neutral-200 rounded-3xl p-8 shadow-premium space-y-6">
              <h3 className="text-lg font-bold text-neutral-950 border-b border-neutral-100 pb-3">Edit Project</h3>
              <form onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className={labelStyle}>Project Name</label>
                  <input className={inputStyle} value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelStyle}>City</label>
                  <input className={inputStyle} value={form.city ?? ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className={labelStyle}>State</label>
                  <input className={inputStyle} value={form.state ?? ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Full Location / Address (Optional)</label>
                  <input className={inputStyle} value={form.full_address ?? ''} onChange={e => setForm(f => ({ ...f, full_address: e.target.value }))} placeholder="e.g. 123, MG Road" />
                </div>
                <div>
                  <label className={labelStyle}>Plot Size (Sq.Ft)</label>
                  <input type="number" className={inputStyle} value={form.plot_size ?? ''} onChange={e => setForm(f => ({ ...f, plot_size: e.target.value }))} />
                </div>

                <div>
                  <label className={labelStyle}>Built-up Area (Sq.Ft)</label>
                  <input type="number" className={inputStyle} value={form.built_up_area ?? ''} onChange={e => setForm(f => ({ ...f, built_up_area: e.target.value }))} />
                </div>
                <div>
                  <label className={labelStyle}>Floors</label>
                  <input type="number" className={inputStyle} value={form.floors ?? ''} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))} />
                </div>
                <div>
                  <label className={labelStyle}>Bedrooms</label>
                  <input type="number" className={inputStyle} value={form.bedrooms ?? ''} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))} />
                </div>
                <div>
                  <label className={labelStyle}>Bathrooms</label>
                  <input type="number" className={inputStyle} value={form.bathrooms ?? ''} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Preferred Materials (Optional)</label>
                  <input className={inputStyle} value={form.preferred_materials ?? ''} onChange={e => setForm(f => ({ ...f, preferred_materials: e.target.value }))} placeholder="e.g. Vitrified tiles, Teak wood doors" />
                </div>
                <div>
                  <label className={labelStyle}>Budget (INR)</label>
                  <input type="number" className={inputStyle} value={form.budget ?? ''} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Description</label>
                  <textarea className={inputStyle} rows={3} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelStyle}>Requirements</label>
                  <textarea className={inputStyle} rows={2} value={form.requirements ?? ''} onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))} />
                </div>
                <div className="md:col-span-2 flex items-center gap-3 pt-3 border-t border-neutral-100">
                  <button type="submit" disabled={saving} className="px-5 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-5 py-2.5 border border-neutral-200 text-neutral-600 text-xs font-bold rounded-xl">Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Project Requirements used for generation */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4 md:col-span-2">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-terracotta" /> Project Requirements
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {projectRequirements.map((req, idx) => (
                    <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                      <span className="text-[10px] text-neutral-400 block font-semibold">{req.label}</span>
                      <strong className="text-neutral-800 font-bold">{req.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status / Type card */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider">Project Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Type</span>
                    <strong className="text-neutral-800 font-bold">{projectTypeLabel(project.project_type)}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Building</span>
                    <strong className="text-neutral-800 font-bold">{project.building_type ?? '—'}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Status</span>
                    <strong className="text-neutral-800 font-bold">{projectStatusLabel(project.status)}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Stage</span>
                    <strong className="text-neutral-800 font-bold">{project.construction_stage ?? '—'}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Plot</span>
                    <strong className="text-neutral-800 font-bold">{project.plot_size != null ? `${project.plot_size} Sq.Ft` : '—'}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Built-up</span>
                    <strong className="text-neutral-800 font-bold">{project.built_up_area != null ? `${project.built_up_area} Sq.Ft` : '—'}</strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Layout</span>
                    <strong className="text-neutral-800 font-bold">
                      {project.floors != null ? `${project.floors} Floor(s)` : '—'}
                      {project.bedrooms != null ? ` ${project.bedrooms} Bed` : ''}
                      {project.bathrooms != null ? ` ${project.bathrooms} Bath` : ''}
                    </strong>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                    <span className="text-[10px] text-neutral-400 block font-semibold">Budget</span>
                    <strong className="text-neutral-800 font-bold">
                      {project.budget_min != null || project.budget_max != null
                        ? `${inrInLakhs(project.budget_min ?? project.budget)} - ${inrInLakhs(project.budget_max ?? project.budget)}`
                        : inrInLakhs(project.budget)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Description card */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4 md:col-span-2">
                <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-terracotta" /> Description & Requirements
                </h3>
                {project.description ? (
                  <p className="text-sm text-neutral-600 leading-relaxed font-light">{project.description}</p>
                ) : (
                  <p className="text-sm text-neutral-400 italic">No description provided.</p>
                )}
                {project.requirements ? (
                  <p className="text-sm text-neutral-600 leading-relaxed font-light border-t border-neutral-100 pt-3">
                    <span className="font-semibold text-neutral-800">Requirements:</span> {project.requirements}
                  </p>
                ) : null}
              </div>

              {/* AI Design Section */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4 md:col-span-2 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-terracotta" /> AI Design Recommendation
                  </h3>
                  {aiResult && (
                    <button onClick={handleGenerateAI} disabled={aiLoading || !projectId} className="px-3 py-1.5 text-xs font-semibold text-terracotta border border-terracotta rounded-lg hover:bg-terracotta-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      <RefreshCw className={"w-3 h-3 " + (aiLoading ? "animate-spin" : "")} />
                      Regenerate
                    </button>
                  )}
                </div>
                {!aiResult && !aiLoading && (
                  <button onClick={handleGenerateAI} disabled={aiLoading || !projectId} className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <Sparkles className="w-4 h-4" /> Generate AI Design
                  </button>
                )}
                {(aiLoading || aiImageLoading) && (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta mx-auto mb-3"></div>
                    {aiLoading ? (
                      <>
                        <p className="text-sm text-neutral-500">Generating your AI house visualization...</p>
                        <p className="text-xs text-neutral-400 mt-1">Analyzing your project requirements and rendering a realistic architectural visualization.</p>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-500">Loading your saved house visualization...</p>
                    )}
                  </div>
                )}
                {aiError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4" />
                      <p className="text-sm">{aiError}</p>
                    </div>
                  </div>
                )}
                {!aiResult && !aiLoading && !aiError && (
                  <p className="text-sm text-neutral-400 italic">Click "Generate AI Design" to receive structured construction recommendations based on your project data.</p>
                )}
                {aiImage.url && (
                  <div className="space-y-4 pt-4 border-t border-neutral-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-terracotta" /> Generated House Image
                      </h4>
                      <div className="flex items-center gap-2">
                        <a href={aiImage.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View Image
                        </a>
                        <a href={aiImage.url} download="buildsmart-ai-house-visualization.png" className="px-3 py-1.5 text-xs font-semibold text-terracotta border border-terracotta rounded-lg hover:bg-terracotta-50 transition-colors flex items-center gap-1">
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50">
                      <img src={aiImage.url} alt="AI generated house visualization based on this project" className="w-full h-auto max-h-[520px] object-cover" />
                    </div>
                    {aiImage.prompt && (
                      <div>
                        <span className="font-semibold text-neutral-800 block text-xs uppercase tracking-wider mb-1">Image Prompt (built from your real project data)</span>
                        <p className="text-xs text-neutral-500 leading-relaxed break-words">{aiImage.prompt}</p>
                      </div>
                    )}
                  </div>
                )}
                {project && (
                  <div className="space-y-2 pt-4 border-t border-neutral-100">
                    <span className="font-semibold text-neutral-800 block text-xs uppercase tracking-wider">Project Requirements Used for Generation</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {projectRequirements.map((req, idx) => (
                        <div key={idx} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100/50">
                          <span className="text-[10px] text-neutral-400 block font-semibold">{req.label}</span>
                          <strong className="text-neutral-800 font-bold">{req.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Phase 2 - AI Project Plan: Budget + Timeline + Design */}
              <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium space-y-4 md:col-span-2 mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-terracotta" /> AI Project Plan
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                      AI-Assisted Project Plan · Generated from your saved project requirements
                    </p>
                  </div>
                  {savedPlan && (
                    <button onClick={handleGeneratePlan} disabled={planLoading || !projectId} className="px-3 py-1.5 text-xs font-semibold text-terracotta border border-terracotta rounded-lg hover:bg-terracotta-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      <RefreshCw className={"w-3 h-3 " + (planLoading ? "animate-spin" : "")} />
                      Regenerate
                    </button>
                  )}
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  <strong>Project Overview — based on your saved project:</strong> {project?.building_type ?? '—'} · {project?.built_up_area != null ? `${project.built_up_area} sq ft` : '—'} · {project?.floors != null ? `${project.floors} floor(s)` : '—'} · {project?.bedrooms != null ? `${project.bedrooms} bed` : '—'} · {project?.bathrooms != null ? `${project.bathrooms} bath` : '—'} · {[project?.city, project?.state].filter(Boolean).join(', ') || '—'}
                </div>
                {!savedPlan && !planLoading && !planError && (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-500">Generate your AI-assisted project plan — a preliminary budget estimate, a phase-wise construction timeline and a design concept, all derived from your saved project requirements (works offline, no external AI service).</p>
                    <button onClick={handleGeneratePlan} disabled={planLoading || !projectId} className="px-4 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      <Sparkles className="w-4 h-4" /> Generate Project Plan
                    </button>
                  </div>
                )}
                {planLoading && (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta mx-auto mb-3"></div>
                    <p className="text-sm text-neutral-500">Compiling your project plan...</p>
                    <p className="text-xs text-neutral-400 mt-1">Building the budget, phase-wise timeline and design concept from your saved project requirements.</p>
                  </div>
                )}
                {planError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div className="flex items-start gap-2 text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Could not generate AI project plan</p>
                        <p className="text-xs mt-1">{planError}</p>
                        <button onClick={handleGeneratePlan} className="mt-2 text-xs font-bold text-red-700 underline hover:text-red-800">Try again</button>
                      </div>
                    </div>
                  </div>
                )}

                {savedPlan && !planLoading && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" /> Preliminary Budget Estimate
                      </h4>
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-extrabold text-emerald-800">
                            {inrInLakhs(savedPlan.budget_estimate_min)} - {inrInLakhs(savedPlan.budget_estimate_max)}
                          </span>
                          <span className="text-xs font-semibold text-emerald-600 uppercase">{savedPlan.budget_currency}</span>
                        </div>
                        {savedPlan.budget_notes && (<p className="text-xs text-emerald-700 mt-1">{savedPlan.budget_notes}</p>)}
                      </div>
                      {savedPlan.budget_breakdown && savedPlan.budget_breakdown.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {savedPlan.budget_breakdown.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-neutral-100 text-xs">
                              <div>
                                <span className="font-semibold text-neutral-800">{item.item}</span>
                                <span className="text-neutral-400 ml-2">{item.category}</span>
                                {item.notes && <span className="text-neutral-400 ml-1">- {item.notes}</span>}
                              </div>
                              <span className="font-bold text-neutral-700">₹{Number(item.estimatedCost).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {savedPlan.timeline_stages && savedPlan.timeline_stages.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-600" /> Construction Timeline
                        </h4>
                        {savedPlan.timeline_notes && (<p className="text-xs text-neutral-500">{savedPlan.timeline_notes}</p>)}
                        <div className="space-y-1.5">
                          {savedPlan.timeline_stages.map((stage, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                              <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-neutral-800 text-xs">{stage.stage}</span>
                                  <span className="text-xs font-bold text-blue-700 flex-shrink-0">
                                    {stage.durationDays} days
                                    {stage.percentOfTimeline != null ? ` · ~${Math.round(stage.percentOfTimeline)}%` : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5">{stage.description}</p>
                                {stage.tasks && stage.tasks.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {stage.tasks.map((task, ti) => (
                                      <li key={ti} className="text-xs text-neutral-500 flex items-start gap-1.5">
                                        <span className="text-terracotta font-bold mt-px">•</span>
                                        <span>{task}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {stage.dependencies && (
                                  <p className="text-[10px] text-neutral-400 mt-1.5 font-semibold">
                                    <span className="uppercase">Depends on:</span> {stage.dependencies}
                                  </p>
                                )}
                                {stage.milestone && (
                                  <p className="text-[10px] text-emerald-700 mt-0.5 font-semibold flex items-start gap-1">
                                    <CheckCircle className="w-3 h-3 mt-px flex-shrink-0" />
                                    <span>Milestone: {stage.milestone}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {savedPlan.design_concept && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-neutral-800 text-sm flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-500" /> Design Concept
                        </h4>
                        {savedPlan.design_style && (
                          <span className="inline-block px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-bold text-amber-700 uppercase">{savedPlan.design_style}</span>
                        )}
                        <p className="text-sm text-neutral-600 leading-relaxed">{savedPlan.design_concept}</p>
                      </div>
                    )}
                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Generated {formatDate(savedPlan.created_at)}</span>
                      {savedPlan.ai_model === LOCAL_PLAN_MODEL ? (
                        <span>Generated locally from your saved project requirements — no external AI service</span>
                      ) : (
                        savedPlan.ai_model && <span>Model: {savedPlan.ai_model}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AI-Assisted Contractor Matching Recommendations */}
              {project && (
                <ContractorRecommendations
                  projectData={{
                    projectId: project.id,
                    location: [project.city, project.state].filter(Boolean).join(', '),
                    city: project.city || '',
                    state: project.state || '',
                    buildingType: project.building_type || '',
                    expectedBudget: project.budget || '',
                    plotSizeSqft: project.plot_size || '',
                    builtUpAreaSqft: project.built_up_area || '',
                    floors: project.floors || '',
                    bedrooms: project.bedrooms || '',
                    bathrooms: project.bathrooms || '',
                    materials: project.preferred_materials || '',
                    designStyle: project.design_style || '',
                    timeline: project.timeline || '',
                    description: project.description || '',
                    requirements: project.requirements || ''
                  }}
                />
              )}
            </div>
          )}
        </>
          )}
        </div>
      );
    };

function stringify(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

const labelStyle = 'font-semibold text-neutral-800 block text-xs uppercase tracking-wider mb-1';
const inputStyle = 'w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:border-terracotta text-sm text-neutral-800 font-semibold bg-white';
