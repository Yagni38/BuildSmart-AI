import React, { useState, useEffect } from 'react';
import {
  Building, Calendar, MessageSquare, Image as ImageIcon,
  ArrowRight, UserCheck, MapPin, Layers, Activity,
  Briefcase, FileText, Sparkles, TrendingUp, Loader, AlertTriangle,
} from 'lucide-react';
import {
  Contractor, Milestone, Message, BudgetItem,
  CustomerProject, SiteUpdate, WeatherAlert,
} from '../mockData';
import { AiInsight } from '../components/AiInsight';
import { PremiumCard } from '../components/PremiumCard';
import { ProgressCircle } from '../components/ProgressCircle';
import { QuickActionCard } from '../components/QuickActionCard';
import { WeatherAlertCard } from '../components/WeatherAlertCard';
import { WeatherRiskCard } from '../components/WeatherRiskCard';
import { ExpenseSummaryChart } from '../components/ExpenseSummaryChart';
import { useAuth } from '../context/AuthContext';
import { getProjectsByCustomer } from '../services/projectService';
import { getAssignedContractorForProject } from '../services/contractorRecommendationService';
import { getWeatherRisk } from '../services/weatherService';
import { getMilestonesByProject } from '../services/milestoneService';
import { getConstructionPhotos } from '../services/constructionPhotoService';
import { fetchProjectSiteLogs } from '../services/siteLogService';
import { getProjectFinancials, subscribeToSpending } from '../services/projectFinancialService';
import { getMaterials } from '../services/materialService';
import type { SiteLogRow } from '../services/siteLogService';
import type { WeatherRiskResult } from '../types/weather';
import type { Project, ConstructionPhoto, ConstructionMaterial } from '../types/project';
import type { ProjectMilestone } from '../types';
import { formatDate, projectStatusLabel } from '../lib/projectUtils';
interface CustomerDashboardProps {
  contractor?: Contractor | null;
  milestones?: Milestone[];
  messages?: Message[];
  project?: CustomerProject | null;
  budgetItems?: BudgetItem[];
  siteUpdate?: SiteUpdate;
  weatherAlert?: WeatherAlert;
  customerName?: string;
  onNavigate: (page: string) => void;
  onOpenProject?: (projectId: string) => void;
}
export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  contractor,
  milestones = [],
  messages = [],
  budgetItems = [],
  siteUpdate,
  customerName,
  onNavigate,
  onOpenProject,
  weatherAlert,
}) => {
  const { user, profile } = useAuth();
  // Use real profile name from Supabase auth
  const displayName =
    customerName ?? profile?.full_name ?? null;
  // Real projects for this customer — loaded from public.projects via
  // getProjectsByCustomer(). No mock/fallback project data is ever shown.
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  useEffect(() => {
    let isActive = true;
    if (!user) {
      setProjectsLoading(false);
      return () => {
        isActive = false;
      };
    }
    setProjectsLoading(true);
    setProjectsError(null);
    getProjectsByCustomer(user.id)
      .then((list) => {
        if (isActive) setProjects(list);
      })
      .catch((err) => {
        if (isActive) {
          setProjectsError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isActive) setProjectsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [user]);
    // Construction weather outlook for the active project's saved location.
  // Uses the browser-safe Open-Meteo API (geocoding + forecast) — no Edge
  // Function, no API key in frontend code. The location is read from the
  // project saved in Supabase via getProjectById().
  const [weatherResult, setWeatherResult] = useState<WeatherRiskResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  function fetchWeather() {
    if (!activeProject) {
      setWeatherResult(null);
      return;
    }
    setWeatherLoading(true);
    setWeatherError(null);
    getWeatherRisk(activeProject.id)
      .then((result) => {
        setWeatherResult(result);
        if (!result.success && result.error) {
          setWeatherError(result.error);
        }
      })
      .catch((err) => {
        setWeatherError(err instanceof Error ? err.message : 'Weather request failed.');
        setWeatherResult({
          success: false,
          code: 'FETCH_ERROR',
          error: err instanceof Error ? err.message : 'Weather request failed.',
        });
      })
      .finally(() => {
        setWeatherLoading(false);
      });
  }
  // Most recent real project → legacy dashboard view-model shape.
  const activeProject: CustomerProject | null =
    projects.length > 0
      ? {
          id: projects[0].id,
          name: projects[0].name,
          location:
            [projects[0].city, projects[0].state].filter(Boolean).join(', ') || '—',
          buildingType: projects[0].building_type ?? '—',
          status: projects[0].status,
          startDate: formatDate(projects[0].created_at),
          totalBudget: (projects[0].budget ?? 0) / 100000,
        }
      : null;

  // Real Supabase project row (for budget/material/cost calculations).
  const realProject: Project | null = projects[0] ?? null;

  // ---- Real budget items + construction materials loaded from Supabase ----
  const [dbBudgetItems, setDbBudgetItems] = useState<BudgetItem[]>([]);
  const [dbMaterials, setDbMaterials] = useState<ConstructionMaterial[]>([]);
  const [financials, setFinancials] = useState<Awaited<ReturnType<typeof getProjectFinancials>> | null>(null);
  const [costLoading, setCostLoading] = useState(true);
  const [costError, setCostError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const projectId = realProject?.id;
    const loadCosts = async () => {
      setCostLoading(true);
      setCostError(null);
      try {
        const [summary, ms] = projectId
          ? await Promise.all([getProjectFinancials(projectId), getMaterials(projectId)])
          : [null, []];
        if (isActive) {
          setFinancials(summary);
          setDbBudgetItems(summary?.items ?? []);
          setDbMaterials(ms);
          if (summary && projectId) setProjects(current => current.map(project => project.id === projectId
            ? { ...project, budget: summary.originalBudget * 100000 } : project));
        }
      } catch (err) {
        if (isActive) setCostError(err instanceof Error ? err.message : 'Failed to load recorded spending.');
      } finally {
        if (isActive) setCostLoading(false);
      }
    };
    void loadCosts();
    const unsubscribe = subscribeToSpending(loadCosts);
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [realProject?.id]);

  // ---- Real Supabase project for budget / material / cost calculations ----
  const [dbAssignedContractor, setDbAssignedContractor] = useState<any | null>(null);
  const [dbMilestones, setDbMilestones] = useState<ProjectMilestone[]>([]);
  const [dbPhotos, setDbPhotos] = useState<ConstructionPhoto[]>([]);
  const [dbLatestUpdate, setDbLatestUpdate] = useState<SiteLogRow | null>(null);

  useEffect(() => {
    fetchWeather();
  }, [activeProject?.id]);

  useEffect(() => {
    let isActive = true;
    if (!activeProject?.id) {
      setDbAssignedContractor(null);
      setDbMilestones([]);
      setDbPhotos([]);
      return;
    }
    getAssignedContractorForProject(activeProject.id)
      .then((res) => {
        if (isActive) setDbAssignedContractor(res);
      })
      .catch(() => {
        if (isActive) setDbAssignedContractor(null);
      });

    Promise.all([
      getMilestonesByProject(activeProject.id).catch(() => []),
      getConstructionPhotos(activeProject.id).catch(() => []),
    ]).then(([ms, phs]) => {
      if (isActive) {
        setDbMilestones(ms);
        setDbPhotos(phs);
      }
    });

    return () => {
      isActive = false;
    };
  }, [activeProject?.id]);

  // Latest real contractor update for the active project (public.site_logs —
  // RLS lets the owning customer read it via is_project_customer). Powers the
  // "Today's Site Update" card; photos flow through dbPhotos above.
  useEffect(() => {
    let isActive = true;
    if (!activeProject?.id) {
      setDbLatestUpdate(null);
      return;
    }
    fetchProjectSiteLogs(activeProject.id, 20)
      .then((logs) => {
        if (isActive) setDbLatestUpdate(logs[0] ?? null);
      })
      .catch(() => {
        if (isActive) setDbLatestUpdate(null);
      });
    return () => {
      isActive = false;
    };
  }, [activeProject?.id]);

  const activeContractor = contractor ?? dbAssignedContractor ?? null;
  const currentMilestone =
    dbMilestones.find(m => (m.status ?? '').toUpperCase() === 'IN_PROGRESS') ??
    dbMilestones.find(m => (m.status ?? '').toUpperCase() === 'PENDING') ??
    milestones.find(m => m.status === 'in-progress');

  const completedCount = dbMilestones.length > 0
    ? dbMilestones.filter(m => (m.status ?? '').toUpperCase() === 'COMPLETED').length
    : milestones.filter(m => m.status === 'completed').length;

  const progressPercent = dbMilestones.length > 0
    ? Math.round(
        (dbMilestones.reduce((acc, m) => {
          const s = (m.status ?? '').toUpperCase();
          return acc + (s === 'COMPLETED' ? 100 : s === 'IN_PROGRESS' ? 50 : 0);
        }, 0) / (dbMilestones.length * 100)) * 100
      )
    : milestones.length > 0
      ? Math.round(
          (milestones.reduce((acc, m) => acc + m.completionPercent, 0) /
            (milestones.length * 100)) * 100
        )
      : 0;

  // Shared Supabase-backed calculation, also used by AdminProjectSpending.
  const totalBudget = financials?.originalBudget ?? 0;
  const spentAmount = financials?.spent ?? 0;
  const remainingBudget = financials?.remaining ?? 0;
  const overBudget = financials?.overBudget ?? 0;
  const estimatedFinalCostL = financials?.estimatedFinalCost;
  const varianceL = estimatedFinalCostL == null ? 0 : estimatedFinalCostL - totalBudget;
  const materialActualInr = dbMaterials.reduce((acc, item) => acc + Number(item.actual_cost ?? 0), 0);

  const displayPhotos = dbPhotos.length > 0
    ? dbPhotos.map(p => p.image_url)
    : (milestones ?? []).flatMap(m => m?.photos ?? []).slice(0, 3);
  const validPhotos = displayPhotos.filter(
    (url): url is string => Boolean(url && typeof url === 'string' && url.trim().length > 0)
  );
  // Prefer an explicitly passed site update; otherwise use the latest real
  // site_logs row for this customer's project (contractor's daily update).
  const effectiveSiteUpdate: SiteUpdate | undefined = siteUpdate ?? (dbLatestUpdate
    ? {
        text: dbLatestUpdate.description ?? '',
        loggedBy:
          (dbAssignedContractor as any)?.full_name ??
          (dbAssignedContractor as any)?.name ??
          'Your contractor',
        loggedAt: dbLatestUpdate.created_at
          ? new Date(dbLatestUpdate.created_at).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })
          : '',
      }
    : undefined);
  const recentMessages = messages.slice(-2);
  const fallbackMessages: Message[] = [
    {
      id: 'fb1',
      sender: 'contractor',
      text: 'Shuttering for the first-floor roof slab is complete. Please review the electrical conduit layout.',
      time: '10:35 AM',
    },
    {
      id: 'fb2',
      sender: 'contractor',
      text: 'Plumbing fixture invoice attached for your approval.',
      time: '10:36 AM',
      attachment: { type: 'pdf', name: 'Plumbing_Fixture_Invoice_P3.pdf' },
    },
  ];
  const displayMessages = recentMessages.length > 0 ? recentMessages : fallbackMessages;
  // Quick Actions — the four primary destinations (2x2 compact layout).
  // Budget/Materials remain reachable via the top navigation and the
  // Expense Summary card's "Full Budget" button.
  const quickActions = [
    {
      icon: Briefcase,
      title: 'Contractor Marketplace',
      description: 'Browse verified builders or compare shortlisted contractors.',
      page: 'marketplace',
      accent: 'neutral' as const,
    },
    {
      icon: Activity,
      title: 'Progress Tracker',
      description: 'View milestone timeline, photos, and AI delay predictions.',
      page: 'tracker',
      accent: 'terracotta' as const,
    },
    {
      icon: MessageSquare,
      title: 'Chat',
      description: 'Message your builder, approve quotes, and share site updates.',
      page: 'chat',
      accent: 'emerald' as const,
    },
    {
      icon: FileText,
      title: 'Reports',
      description: 'Download progress reports and escrow payment summaries.',
      page: 'reports',
      accent: 'terracotta' as const,
    },
  ];
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm text-neutral-400 font-medium mb-1">
            Welcome back, <span className="text-neutral-700 font-semibold">{displayName}</span>
          </p>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
            Customer Dashboard
          </h1>
          <p className="text-neutral-500 font-light mt-1">
            Your construction command center — track progress, costs, and site activity in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {activeProject?.status ?? 'No Projects'}
          </span>
          <span className="text-sm font-semibold text-neutral-500">ID: {activeProject?.id ?? '—'}</span>
        </div>
      </div>
      {/* Current Project Card — real project loaded from public.projects.
          No mock/fallback project is displayed once these are real. */}
      {activeProject ? (
        <PremiumCard glow className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
                <Building className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Current Project
                </span>
                <h2 className="text-xl font-extrabold text-neutral-950 mt-0.5">{activeProject.name}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-terracotta" />
                    {activeProject.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-terracotta" />
                    {activeProject.buildingType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-terracotta" />
                    Created {activeProject.startDate}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 self-start md:self-center">
              {onOpenProject && (
                <button
                  onClick={() => onOpenProject(activeProject.id)}
                  className="px-5 py-2.5 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-premium hover:shadow-premium-hover"
                >
                  View Project Details <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onNavigate('tracker')}
                className="px-5 py-2.5 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
              >
                View Full Tracker <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </PremiumCard>
      ) : (
        <PremiumCard className="p-8 text-center">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-terracotta flex items-center justify-center">
              <Building className="w-7 h-7" />
            </div>
            {projectsLoading ? (
              <p className="text-sm text-neutral-400 font-medium">Loading your projects…</p>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-extrabold text-neutral-950">No projects yet</h2>
                  <p className="text-sm text-neutral-400 font-light mt-1">
                    Create your first construction project to get started.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('create-project')}
                  className="px-6 py-3 bg-terracotta hover:bg-terracotta-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-premium hover:shadow-premium-hover"
                >
                  <Sparkles className="w-4 h-4" /> Create Project
                </button>
              </>
            )}
            {projectsError && (
              <p className="text-xs text-red-600 font-mono bg-red-50 border border-red-100 rounded-xl px-3 py-2 max-w-md break-words">
                {projectsError}
              </p>
            )}
          </div>
        </PremiumCard>
      )}
      {/* Your Projects — real list from public.projects via getProjectsByCustomer() */}
      {!projectsLoading && projects.length > 0 && (
        <PremiumCard title="Your Projects">
          <div className="space-y-3">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onOpenProject?.(p.id)}
                className="w-full text-left p-4 rounded-2xl border border-neutral-100 hover:border-terracotta hover:bg-terracotta-50/20 transition-all flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-neutral-100 text-terracotta flex items-center justify-center font-extrabold text-xs">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-neutral-800 text-sm">{p.name}</h4>
                    <p className="text-xs text-neutral-400 font-light">
                      {[p.city, p.state].filter(Boolean).join(', ') || '—'} · {formatDate(p.created_at)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-neutral-400 flex items-center gap-1">
                  {projectStatusLabel(p.status)} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </PremiumCard>
      )}
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Progress + Budget + Contractor Summary */}
          <PremiumCard glow className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Construction Progress
                </span>
                <ProgressCircle
                  percent={progressPercent}
                  label={currentMilestone ? ((currentMilestone as any).title ?? (currentMilestone as any).name ?? 'Stage') : 'Roof Slab & Concreting'}
                  sublabel={`Milestone ${completedCount + 1} of ${dbMilestones.length || milestones.length || 5}`}
                />
              </div>
              <div className="space-y-2 border-y md:border-y-0 md:border-x border-neutral-100 py-4 md:py-0 md:px-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Cost Summary
                </span>
                <div className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Budget:</span>
                    <span className="text-base font-bold text-neutral-800">
                      {costLoading ? 'Loading…' : costError ? 'Unavailable' : `₹${totalBudget.toFixed(2)} Lakhs`}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-neutral-500">Spent:</span>
                    <span className="text-base font-bold text-red-500">
                      {costLoading ? 'Loading…' : costError ? 'Unavailable' : `₹${spentAmount.toFixed(2)} Lakhs`}
                    </span>
                  </div>
                  {!costLoading && !costError && overBudget > 0 && <p className="text-sm font-bold text-red-600">Over Budget: ₹{overBudget.toFixed(2)} Lakhs</p>}
                  {!costLoading && !costError && estimatedFinalCostL != null && <p className="text-xs text-neutral-500">Current Estimated Final Cost: ₹{estimatedFinalCostL.toFixed(2)} Lakhs (spent + remaining item allocations)</p>}
                  <div className="flex justify-between items-baseline border-t border-dashed border-neutral-100 pt-1.5 mt-1">
                    <span className="text-sm text-neutral-900 font-semibold">Remaining:</span>
                    <span className="text-base font-extrabold text-emerald-600">
                      {costLoading ? 'Loading…' : costError ? 'Unavailable' : `₹${remainingBudget.toFixed(2)} Lakhs`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                    Current Contractor
                  </span>
                  {activeContractor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-sm">
                        {(activeContractor.company || activeContractor.full_name || 'C').charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-800 text-sm">{activeContractor.company || activeContractor.full_name || 'Verified Contractor'}</h4>
                        <p className="text-xs text-neutral-500">{activeContractor.owner || activeContractor.email || 'Contractor'}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onNavigate('marketplace')}
                      className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
                    >
                      Hire a Contractor <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-neutral-400">
                  Response:{' '}
                  <span className="font-semibold text-neutral-700">
                    {activeContractor?.responseTime ?? '—'}
                  </span>
                  {' · '}
                  Rating:{' '}
                  <span className="font-semibold text-neutral-700">
                    {activeContractor?.rating ?? '—'} ★
                  </span>
                </div>
              </div>
            </div>
          </PremiumCard>
          {/* Today's Update + Next Milestone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PremiumCard title="Today's Site Update">
              {effectiveSiteUpdate ? (
                <>
                  <p className="text-sm text-neutral-700 font-medium leading-relaxed">
                    "{effectiveSiteUpdate.text}"
                  </p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold pt-3 mt-3 border-t border-neutral-100">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Logged by {effectiveSiteUpdate.loggedBy} at {effectiveSiteUpdate.loggedAt}
                  </div>
                </>
              ) : (
                <p className="text-sm text-neutral-400">No site updates yet.</p>
              )}
            </PremiumCard>
            <PremiumCard title="Next Milestone">
              {currentMilestone ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-neutral-800 text-base">
                      {(currentMilestone as any).title ?? (currentMilestone as any).name}
                    </h4>
                    <span className="text-xs bg-terracotta-50 text-terracotta font-semibold px-2 py-0.5 rounded">
                      {(currentMilestone as any).status ?? 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed font-light">
                    {(currentMilestone as any).description ?? (currentMilestone as any).comments ?? 'Work in progress for this milestone.'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-400 italic">All milestones completed.</p>
              )}
            </PremiumCard>
          </div>
          {/* Expense Summary — compact empty state when no expense
              entries exist yet (previously rendered as a blank white area). */}
          <PremiumCard
            title="Expense Summary"
            className="p-5"
            action={
              <button
                onClick={() => onNavigate('budget')}
                className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
              >
                Full Budget <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            {costLoading ? <p className="text-sm text-neutral-400">Loading recorded spending…</p> : costError ? (
              <p role="alert" className="text-sm text-red-600">{costError}</p>
            ) : (
              <>
                {dbBudgetItems.length > 0 ? <ExpenseSummaryChart items={dbBudgetItems} /> : (
                  <p className="text-sm text-neutral-400 py-1">No expense entries recorded yet. Estimates are available in the Budget Estimator.</p>
                )}
                <p className="text-sm font-semibold mt-3">Material actuals: ₹{materialActualInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-neutral-400 mt-1">Recorded material costs are included in project spending, not added a second time. Estimates are location-adjusted; progress updates are not expenses.</p>
              </>
            )}
          </PremiumCard>
          {/* Recent Progress Photos */}
          <PremiumCard
            title="Recent Progress Photos"
            className="p-5"
            action={
              <button
                onClick={() => onNavigate('tracker')}
                className="text-xs text-terracotta font-semibold hover:underline flex items-center gap-0.5"
              >
                View Tracker <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            {validPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {validPhotos.map((url, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer border border-neutral-100 bg-neutral-100"
                  >
                    <img
                      src={url}
                      alt={`Site progress ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 py-1">
                No progress photos uploaded yet. Photos will appear here as your contractor updates site logs.
              </p>
            )}
          </PremiumCard>
          {/* Quick Actions — compact 2x2 grid, immediately after
              Recent Progress Photos in the main content column. */}
          <PremiumCard
            title="Quick Actions"
            className="p-5"
            action={
              <span className="text-[10px] text-neutral-400 hidden sm:inline">
                Access your project tools quickly
              </span>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map(action => (
                <QuickActionCard
                  key={action.page}
                  icon={action.icon}
                  title={action.title}
                  description={action.description}
                  accent={action.accent}
                  onClick={() => onNavigate(action.page)}
                />
              ))}
            </div>
          </PremiumCard>
        </div>
        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Construction Weather Outlook (Phase 8) */}
          {weatherLoading ? (
            <PremiumCard title="Construction Weather Outlook" className="flex flex-col items-center justify-center py-8">
              <Loader className="w-5 h-5 text-neutral-300 animate-spin mb-2" />
              <p className="text-xs text-neutral-400">Loading weather outlook…</p>
            </PremiumCard>
          ) : weatherResult ? (
            <WeatherRiskCard
              result={weatherResult}
              city={activeProject?.location.split(',')[0]?.trim() ?? ''}
              state={activeProject?.location.split(',').slice(1).join(',').trim() ?? null}
              onRetry={weatherError ? () => fetchWeather() : undefined}
            />
          ) : (
            <PremiumCard title="Construction Weather Outlook" className="flex flex-col items-center justify-center py-8">
              <p className="text-xs text-neutral-400">No active project</p>
            </PremiumCard>
          )}

          {/* Weather Alert — real data from WeatherRiskCard impacts, or hidden */}
          {weatherResult && weatherResult.data && weatherResult.data.risk && weatherResult.data.risk.impacts.length > 0 && (
            <PremiumCard title="Weather Advisory">
              <div className="space-y-2">
                {weatherResult.data.risk.impacts.map((impact, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-100"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">{impact}</p>
                  </div>
                ))}
              </div>
              {weatherResult.data.risk.precautions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-2">
                    Recommended Precautions
                  </p>
                  <div className="space-y-1.5">
                    {weatherResult.data.risk.precautions.map((precaution, i) => (
                      <p
                        key={i}
                        className="text-xs text-amber-700 leading-relaxed pl-4 border-l-2 border-amber-300"
                      >
                        {precaution}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </PremiumCard>
          )}
          {/* Steel price insight — planning/demo only, not live market data */}
          <PremiumCard title="Market Insight (Demo)">
            <div className="mt-3 p-3 rounded-xl bg-rose-50/60 border border-rose-100 flex gap-2">
              <TrendingUp className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Steel prices rising 4.2% next Tuesday.{' '}
                <button
                  onClick={() => onNavigate('materials')}
                  className="text-rose-800 font-semibold hover:underline"
                >
                  Pre-book materials →
                </button>
              </p>
            </div>
            <p className="mt-2 text-[9px] text-neutral-400 italic">
              This is a demo insight for planning purposes only. Not live market data.
            </p>
          </PremiumCard>
          {/* Recent Messages */}
          <PremiumCard title="Recent Messages" className="flex flex-col">
            <div className="space-y-3 mb-4">
              {displayMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-terracotta-50 text-terracotta flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {msg.sender === 'contractor' ? 'C' : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="p-3 rounded-2xl bg-neutral-50 text-neutral-700 text-xs leading-relaxed">
                      {msg.text}
                      {msg.attachment && (
                        <div className="mt-2 p-2 rounded bg-white border border-neutral-200 flex items-center gap-1.5 font-medium text-neutral-800">
                          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded">
                            PDF
                          </span>
                          <span className="truncate">{msg.attachment.name}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 block text-right mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate('chat')}
              className="w-full py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-neutral-200/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4 text-neutral-500" />
              Open Full Workspace Chat
            </button>
          </PremiumCard>
          {/* Site Snapshot — compact summary of current project state.
              PHASE 2 FIX: this card was previously nested INSIDE the
              Recent Messages card (double </PremiumCard> close), which
              broke the right column's spacing/rounding. Now a sibling. */}
          <PremiumCard title="Site Snapshot">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Status</p>
                  <p className="text-sm font-bold text-neutral-800">
                    {activeProject ? projectStatusLabel(activeProject.status) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Progress</p>
                  <p className="text-sm font-bold text-neutral-800">
                    {progressPercent}% · {completedCount}/{milestones.length || 6} milestones
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Next Milestone</p>
                  <p className="text-sm font-bold text-neutral-800 leading-tight">
                    {(currentMilestone as any)?.title ?? (currentMilestone as any)?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Remaining</p>
                  <p className="text-sm font-bold text-emerald-600">
                    ₹{Math.max(0, remainingBudget).toFixed(1)}L
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-neutral-100 text-[10px] text-neutral-400 italic leading-relaxed">
                {activeProject ? (
                  <>
                    {activeProject.location} · {formatDate(activeProject.startDate)} start
                  </>
                ) : (
                  'No project selected'
                )}
              </div>
            </div>
          </PremiumCard>
        </div>
      </div>
      {/* AI Insight */}
      <AiInsight
        insight="Daily logs confirm AAC blocks are successfully placed for partition walls, lowering structural load and concrete volumes by 8.4%."
        recommendation="Verify electrical conduit layout in the AI Design Studio before the concrete slab is cast next Tuesday."
        confidenceScore={98}
        impactValue="₹1,50,000 Potential Savings"
      />
    </div>
  );
};

