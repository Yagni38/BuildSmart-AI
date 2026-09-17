import React, { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Loader2, AlertCircle, Building2, MapPin, User,
  TrendingUp, Camera, MessageSquare, CalendarDays, Printer, CheckCircle2,
} from 'lucide-react';
import {
  getProjectReport,
  formatBudget,
  formatReportDate,
  formatReportDateTime,
  ProjectReport,
} from '../services/reportService';
import type { BudgetItem, ConstructionMaterial } from '../types/project';

interface ReportPageProps {
  projectId?: string | null;
}

/**
 * Phase 10 — Real Project Report.
 *
 * Assembles a project summary entirely from Supabase (project row, contractor
 * profile, milestones, project updates, construction photos). No financial
 * values are invented — budget figures come only from the project's own
 * budget columns. Spent/remaining amounts are NOT shown because there is no
 * dedicated budget/payment table in the database yet.
 */
export const ReportPage: React.FC<ReportPageProps> = ({ projectId }) => {
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!projectId) {
      setError('No project selected. Open a project from the dashboard to view its report.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await getProjectReport(projectId));
    } catch (err) {
      console.warn('[ReportPage] failed to load project report:', err);
      setError(err instanceof Error ? err.message : String(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    window.print();
  };

  const completedMilestones = report?.milestones.filter(
    (m) => (m.status ?? '').toUpperCase() === 'COMPLETED' || Number(m.progress ?? 0) >= 100
  ).length ?? 0;
  const totalMilestones = report?.milestones.length ?? 0;
  const overallProgress = report?.project.progress ?? 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-6 px-4">
      {/* Title + print button */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Reports & Compliance</h1>
          <p className="text-neutral-500 font-light mt-1">
            Project summary generated from live data — progress, milestones, updates and photos.
          </p>
        </div>
        {report && (
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Generating project report…
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm font-semibold text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && report && (
        <>
          {/* Project information */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-terracotta" />
              <h2 className="text-lg font-extrabold text-neutral-900">Project Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Project Name</span>
                <p className="font-semibold text-neutral-900 mt-0.5">{report.project.name}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Status</span>
                <p className="font-semibold text-neutral-900 mt-0.5">{report.project.status}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Building Type</span>
                <p className="font-semibold text-neutral-900 mt-0.5">{report.project.building_type ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Location</span>
                <p className="font-semibold text-neutral-900 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[report.project.city, report.project.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Created</span>
                <p className="font-semibold text-neutral-900 mt-0.5">{formatReportDate(report.project.created_at)}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-neutral-400 uppercase">Last Updated</span>
                <p className="font-semibold text-neutral-900 mt-0.5">{formatReportDateTime(report.project.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* Budget + Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Budget Overview</span>
              <div className="text-3xl font-extrabold text-neutral-900 mt-2">
                {formatBudget(report.budgetSummary.totalBudget)}
              </div>
              {report.project.budget_min != null && report.project.budget_max != null && (
                <p className="text-[10px] text-neutral-400 font-medium mt-2">
                  Range: {formatBudget(report.project.budget_min)} – {formatBudget(report.project.budget_max)}
                </p>
              )}
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Material Cost Estimate</span>
                  <span className="font-semibold text-neutral-700">{formatBudget(report.budgetSummary.materialCostEstimate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Amount Spent</span>
                  <span className="font-semibold text-neutral-700">{formatBudget(report.budgetSummary.totalSpent)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-neutral-100 pt-1.5">
                  <span className="text-neutral-500 font-semibold">Remaining</span>
                  <span className={`font-bold ${report.budgetSummary.isOverBudget ? 'text-red-600' : 'text-emerald-600'}`}>
                    {report.budgetSummary.remaining != null ? formatBudget(report.budgetSummary.remaining) : '—'}
                  </span>
                </div>
                {report.budgetSummary.isOverBudget && (
                  <p className="text-[10px] text-red-600 font-semibold mt-1">
                    ⚠ Project is over budget. Review expenses with your contractor.
                  </p>
                )}
              </div>
              {report.budgetSummary.budgetItems.length === 0 && report.budgetSummary.materials.length === 0 && (
                <p className="text-[10px] text-neutral-400 font-medium mt-2">
                  Detailed budget breakdown requires the Phase 11 migration.
                </p>
              )}
            </div>

            <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Project Progress</span>
                <TrendingUp className="w-4 h-4 text-terracotta" />
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 mt-2">{overallProgress}%</div>
              <div className="w-full bg-neutral-50 h-2.5 rounded-full overflow-hidden border border-neutral-100 mt-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(Math.max(overallProgress, 0), 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-neutral-400 font-medium mt-2">
                {completedMilestones} of {totalMilestones} milestones complete
              </p>
            </div>
          </div>

      {/* Contractor */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Assigned Contractor</span>
        {report.contractor ? (
          <div className="mt-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-terracotta-50 flex items-center justify-center">
              <User className="w-5 h-5 text-terracotta" />
            </div>
            <div>
              <p className="font-semibold text-neutral-900">{report.contractor.fullName ?? '—'}</p>
              <p className="text-xs text-neutral-400">{report.contractor.companyName ?? 'Independent contractor'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400 mt-2">No contractor assigned yet.</p>
        )}
      </div>

      {/* Contractor Performance + Current Stage */}
      {report.contractorPerformance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Contractor Performance</span>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Milestone Completion</span>
                <span className="font-semibold text-neutral-700">{report.contractorPerformance.milestoneCompletionRate}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${report.contractorPerformance.milestoneCompletionRate}%` }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Updates Posted</span>
                <span className="font-semibold text-neutral-700">{report.contractorPerformance.updateCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Avg. Milestone Progress</span>
                <span className="font-semibold text-neutral-700">{report.contractorPerformance.averageProgressPerMilestone}%</span>
              </div>
            </div>
          </div>
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Current Stage</span>
            <div className="mt-3">
              <p className="text-lg font-extrabold text-neutral-900">{report.currentStage ?? 'Not started'}</p>
              {report.project.timeline && (
                <p className="text-[10px] text-neutral-400 font-medium mt-2 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Expected completion: {formatReportDate(report.project.timeline)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Milestones</span>
          <span className="text-xs font-bold text-neutral-400">{completedMilestones}/{totalMilestones}</span>
        </div>
        {report.milestones.length > 0 ? (
          <div className="mt-4 space-y-3">
            {report.milestones.map((m) => {
              const done = (m.status ?? '').toUpperCase() === 'COMPLETED' || Number(m.progress ?? 0) >= 100;
              return (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-neutral-300 shrink-0" />
                    )}
                    <span className={`text-sm font-semibold truncate ${done ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
                      {m.title}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-neutral-400 shrink-0">{m.progress ?? 0}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 mt-3">No milestones defined yet.</p>
        )}
      </div>

      {/* Latest Activity */}
      {report.latestActivity && (
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Latest Activity</span>
          <p className="text-sm font-semibold text-neutral-900 mt-2 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-terracotta" />
            {formatReportDateTime(report.latestActivity)}
          </p>
        </div>
      )}

      {/* Construction Updates */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Construction Updates</span>
        </div>
        {report.updates.length > 0 ? (
          <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
            {report.updates.map((u) => (
              <div key={u.id} className="border-l-2 border-terracotta/30 pl-3">
                <p className="text-sm font-semibold text-neutral-900">{u.title ?? u.update_type}</p>
                {u.content && <p className="text-xs text-neutral-500 mt-0.5">{u.content}</p>}
                <p className="text-[10px] text-neutral-400 mt-1">{formatReportDateTime(u.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 mt-3">No updates posted yet.</p>
        )}
      </div>

      {/* Construction Photos */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-neutral-400" />
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Construction Photos</span>
          <span className="text-xs font-bold text-neutral-400">{report.photos.length}</span>
        </div>
        {report.photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {report.photos.map((p) => (
              <div key={p.id} className="group relative aspect-square rounded-xl overflow-hidden border border-neutral-100">
                <img
                  src={p.image_url}
                  alt={p.caption ?? 'Construction photo'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {p.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1">
                    <p className="text-[10px] text-white font-medium truncate">{p.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 mt-3">No photos uploaded yet.</p>
        )}
      </div>
        </>
      )}
    </div>
  );
};