/**
 * Phase 15 — FINAL Admin Dashboard
 *
 * Sections:
 *   1. CONTRACTOR APPLICATIONS (Pending / Approved / Rejected)
 *   2. PROJECTS (Active / Completed)
 *   3. VERIFICATION (review, resume, experience, previous projects, approve, reject)
 *   4. MONITORING (progress, construction updates, weather alerts, assignments)
 *
 * Access: ADMIN role only. Customers and contractors are blocked.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, ShieldCheck, AlertCircle, Check, X,
  FileText, Clock, MapPin, Briefcase, Eye, Loader2, RefreshCw,
  Mail, Phone, Building2, CheckCircle2, ExternalLink, ArrowRight, XCircle,
  Activity, ClipboardList, CloudSun, CloudRain, TrendingUp, UserPlus,
  AlertTriangle, BarChart3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getContractorsByStatus,
  updateContractorVerification,
  getSignedResumeUrl,
  isVerificationVerified,
  getPreviousProjectsForContractor,
} from '../services/contractorService';
import { getAllProjects, getProjectUpdatesForAdmin } from '../services/adminService';
import { getWeatherRisk } from '../services/weatherService';
import type { WeatherRiskResult } from '../types/weather';
import { AdminAccessGate } from '../components/AdminAccessGate';
import { getProjectFinancials, subscribeToSpending } from '../services/projectFinancialService';

/** Both dashboards fetch the same project budget and ledger calculation. */
const AdminProjectSpending: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [costs, setCosts] = useState<Awaited<ReturnType<typeof getProjectFinancials>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const summary = await getProjectFinancials(projectId);
        if (active) { setCosts(summary); setError(null); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load spending.');
      }
    };
    void load();
    const unsubscribe = subscribeToSpending(load);
    return () => { active = false; unsubscribe(); };
  }, [projectId]);
  if (error) return <span role="alert" className="text-red-600">{error}</span>;
  if (!costs) return <span className="text-neutral-400">Loading…</span>;
  return <div className="space-y-1">
    <p>Original Budget: ₹{costs.originalBudget.toFixed(2)}L</p>
    <p>Spent: ₹{costs.spent.toFixed(2)}L</p>
    <p>Remaining: ₹{costs.remaining.toFixed(2)}L</p>
    {costs.overBudget > 0 && <p className="text-red-600">Over Budget: ₹{costs.overBudget.toFixed(2)}L</p>}
    {costs.estimatedFinalCost !== null && <p>Current Estimated Final Cost: ₹{costs.estimatedFinalCost.toFixed(2)}L</p>}
  </div>;
};

// ============================================================
// Phase 3 — REAL Admin Contractor Verification
// ============================================================
// Clear, DB-backed statuses:
//   PENDING  -> application awaiting admin review (amber)
//   VERIFIED -> admin-approved. THE ONLY status allowed in the
//               verified contractor pool / recommendations (green).
//               Every approval writes verification_status = 'VERIFIED'
//               to public.profiles + public.contractor_profiles.
//   REJECTED -> rejected with a stored rejection_reason (red).
// Legacy 'APPROVED' is displayed as "Verified" for backward
// compatibility (see isVerificationVerified).
// ============================================================

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | null;
type AdminTab = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Mirrors the actual columns of the public.profiles row for a contractor. */
interface ContractorRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  location: string | null;
  skills: string | null;
  years_of_experience: number | null;
  project_types: string | null;
  description: string | null;
  resume_path: string | null;
  resume_url: string | null;
  verification_status: VerificationStatus;
  rejection_reason?: string | null;
  created_at: string;
}

const statusLabel = (s: VerificationStatus): string => {
  if (isVerificationVerified(s)) return 'Verified';
  if (s === 'REJECTED') return 'Rejected';
  return 'Pending';
};

/**
 * SECTION 2: PROJECTS — Active / Completed project listing for admin oversight.
 */
const AdminProjectsSection: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusFilter = projectTab === 'ACTIVE'
        ? 'IN_PROGRESS,ACTIVE_BUILD,CONTRACTOR_SELECTED'
        : 'COMPLETED';
      const data = await getAllProjects(statusFilter);
      setProjects(data ?? []);
    } catch (err: any) {
      console.error('[AdminProjectsSection] Failed:', err?.message);
      setError(err?.message || 'Failed to load projects.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [projectTab]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const fmtBudget = (p: any): string => {
    const amount = p.budget;
    if (amount == null) return '—';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const statusColor = (status: string) => {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-terracotta" /> Projects
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setProjectTab('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              projectTab === 'ACTIVE'
                ? 'bg-blue-600 text-white'
                : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setProjectTab('COMPLETED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              projectTab === 'COMPLETED'
                ? 'bg-emerald-600 text-white'
                : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-neutral-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading projects...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-neutral-400">No {projectTab.toLowerCase()} projects found.</p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Project</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Status</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Progress</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Budget</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Recorded Spending</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Location</th>
                  <th className="text-left p-3 font-bold text-neutral-500 uppercase">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {projects.map((p: any) => (
                  <tr key={p.id} className="hover:bg-neutral-50/50">
                    <td className="p-3 font-semibold text-neutral-800">{p.name || 'Unnamed'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full bg-terracotta rounded-full" style={{ width: `${p.progress ?? 0}%` }} />
                        </div>
                        <span className="font-semibold text-neutral-600">{p.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-neutral-700">{fmtBudget(p)}</td>
                    <td className="p-3 text-neutral-700"><AdminProjectSpending projectId={p.id} /></td>
                    <td className="p-3 text-neutral-500">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="p-3 text-neutral-400">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SECTION 4: MONITORING — Project progress, construction updates, weather alerts, assignments.
 */
const AdminMonitoringSection: React.FC = () => {
  const [updates, setUpdates] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitoringTab, setMonitoringTab] = useState<'progress' | 'updates' | 'weather' | 'assignments'>('progress');

  const loadMonitoringData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [updatesData, assignmentsData] = await Promise.all([
        getProjectUpdatesForAdmin(20).catch(() => []),
        getAllProjects('IN_PROGRESS,ACTIVE_BUILD,CONTRACTOR_SELECTED').catch(() => []),
      ]);
      setUpdates(updatesData ?? []);
      setAssignments(assignmentsData ?? []);
    } catch (err: any) {
      console.error('[AdminMonitoringSection] Failed:', err?.message);
      setError(err?.message || 'Failed to load monitoring data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMonitoringData();
  }, [loadMonitoringData]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-neutral-900 flex items-center gap-2">
        <Activity className="w-5 h-5 text-terracotta" /> Monitoring
      </h2>
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'progress', label: 'Progress', icon: TrendingUp },
          { value: 'updates', label: 'Updates', icon: ClipboardList },
          { value: 'weather', label: 'Weather', icon: CloudRain },
          { value: 'assignments', label: 'Assignments', icon: UserPlus },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setMonitoringTab(tab.value as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              monitoringTab === tab.value
                ? 'bg-terracotta text-white'
                : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>
      {loading && (
        <div className="text-sm text-neutral-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading monitoring data...
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {!loading && monitoringTab === 'progress' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-700">Active Project Progress</h3>
          {assignments.length === 0 ? (
            <p className="text-xs text-neutral-400">No active projects to monitor.</p>
          ) : (
            <div className="space-y-2">
              {assignments.slice(0, 10).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-neutral-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-800 truncate">{p.name || 'Unnamed'}</p>
                    <p className="text-[10px] text-neutral-400">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="w-24">
                    <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div className="h-full bg-terracotta rounded-full" style={{ width: `${p.progress ?? 0}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 text-center mt-0.5">{p.progress ?? 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && monitoringTab === 'updates' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-700">Recent Construction Updates</h3>
          {updates.length === 0 ? (
            <p className="text-xs text-neutral-400">No construction updates yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {updates.map((u: any) => (
                <div key={u.id} className="p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-neutral-800">{u.title || u.update_type || 'Update'}</p>
                    <span className="text-[10px] text-neutral-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  {u.content && <p className="text-[11px] text-neutral-500 mt-0.5">{u.content}</p>}
                  {u.contractor_name && (
                    <p className="text-[10px] text-neutral-400 mt-1">Contractor: {u.contractor_name}</p>
                  )}
                  {u.image_url && (
                    <img src={u.image_url} alt="Progress photo" className="mt-1 rounded-lg max-h-24 object-cover" loading="lazy" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!loading && monitoringTab === 'weather' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-1.5">
            <CloudSun className="w-4 h-4" /> Weather Alerts
          </h3>
          <p className="text-xs text-neutral-400">Weather alerts for active project locations will appear here.</p>
        </div>
      )}
      {!loading && monitoringTab === 'assignments' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-neutral-700">Customer-Contractor Assignments</h3>
          {assignments.length === 0 ? (
            <p className="text-xs text-neutral-400">No active assignments.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-neutral-800 truncate">{p.name || 'Unnamed'}</p>
                    <p className="text-[10px] text-neutral-400">
                      Customer: {p.customer_id?.slice(0, 8) || 'Unknown'} · Contractor: {p.contractor_id?.slice(0, 8) || 'Unassigned'}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${p.contractor_id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {p.contractor_id ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Convert a LIVE contractor_profiles row to the admin ContractorRecord shape.
 *  Live columns only: id, full_name, email, phone, location, skills,
 *  experience_years, project_types, resume_url, verification_status,
 *  created_at. NULL/empty/lowercase statuses normalize to PENDING. */
function toContractorRecord(row: any): ContractorRecord {
  const rawStatus = String(row.verification_status ?? '').trim().toUpperCase();
  const normalized: VerificationStatus =
    rawStatus === 'VERIFIED' || rawStatus === 'APPROVED'
      ? (rawStatus as VerificationStatus)
      : rawStatus === 'REJECTED'
        ? 'REJECTED'
        : 'PENDING';
  return {
    id: String(row.id),
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    phone: row.phone ?? null,
    company_name: null,
    location: row.location ?? null,
    skills: row.skills ?? null,
    years_of_experience:
      row.experience_years == null ? null : Number(row.experience_years),
    project_types: row.project_types ?? null,
    description: null,
    resume_path: null,
    resume_url: row.resume_url ?? null,
    verification_status: normalized,
    rejection_reason: row.rejection_reason ?? null,
    created_at: String(row.created_at ?? ''),
  };
}

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<AdminTab>('PENDING');
  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ContractorRecord | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const [changeOpen, setChangeOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<'VERIFIED' | 'REJECTED' | 'PENDING'>('VERIFIED');
  const [changeError, setChangeError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    if (toastTimer) window.clearTimeout(toastTimer);
    setToast({ type, message });
    const timer = window.setTimeout(() => setToast(null), 5200);
    setToastTimer(timer);
  };

  const loadContractors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getContractorsByStatus(activeTab);
      console.log('ADMIN CONTRACTOR QUERY RESULT:', data);
      setContractors((data ?? []).map(toContractorRecord));
    } catch (err: any) {
      console.error('ADMIN CONTRACTOR QUERY ERROR:', err);
      setError(err?.message || 'Failed to load contractors.');
      setContractors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContractors();
  }, [activeTab]);

  const openDetails = async (c: ContractorRecord) => {
    setSelected(c);
    setResumeUrl(null);
    setRejectReason('');
    setChangeOpen(false);
    setChangeError(null);
    setNextStatus('VERIFIED');
    if (c.resume_path || c.resume_url) {
      setResumeLoading(true);
      try {
        const url = await getSignedResumeUrl(c.resume_url || c.resume_path || '');
        setResumeUrl(url);
      } catch (err: any) {
        console.warn('[AdminDashboard] Resume URL failed:', err?.message);
        setResumeUrl(null);
      } finally {
        setResumeLoading(false);
      }
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setResumeUrl(null);
    setChangeOpen(false);
    setChangeError(null);
    setRejectReason('');
  };

  const patchLocalStatus = (id: string, status: VerificationStatus, reason?: string | null) => {
    setContractors(prev =>
      prev.map(c => (c.id === id ? { ...c, verification_status: status, rejection_reason: reason } : c))
    );
  };

  const handleApprove = async (c: ContractorRecord) => {
    setActionBusy(true);
    try {
      await updateContractorVerification(c.id, 'VERIFIED');
      patchLocalStatus(c.id, 'VERIFIED', null);
      showToast('success', `${c.full_name || c.company_name || 'Contractor'} is now Verified.`);
      setSelected(null);
      setActiveTab('VERIFIED');
    } catch (err: any) {
      console.error('[AdminDashboard] Approve failed:', err?.message);
      showToast('error', `Approval failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (c: ContractorRecord) => {
    const reason = rejectReason.trim();
    if (!reason) {
      showToast('error', 'Please enter a rejection reason before rejecting.');
      return;
    }
    setActionBusy(true);
    try {
      await updateContractorVerification(c.id, 'REJECTED', reason);
      patchLocalStatus(c.id, 'REJECTED', reason);
      showToast('success', `${c.full_name || c.company_name || 'Contractor'} was rejected with a reason.`);
      setSelected(null);
      setActiveTab('REJECTED');
    } catch (err: any) {
      console.error('[AdminDashboard] Reject failed:', err?.message);
      showToast('error', `Rejection failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleChangeStatus = async (c: ContractorRecord) => {
    setActionBusy(true);
    setChangeError(null);
    try {
      await updateContractorVerification(
        c.id,
        nextStatus,
        nextStatus === 'REJECTED' ? (rejectReason.trim() || undefined) : undefined
      );
      patchLocalStatus(
        c.id,
        nextStatus,
        nextStatus === 'REJECTED' ? (rejectReason.trim() || null) : null
      );
      showToast('success', `Status changed to ${statusLabel(nextStatus)}.`);
      setSelected(null);
      setChangeOpen(false);
      setRejectReason('');
      setActiveTab(
        nextStatus === 'VERIFIED'
          ? 'VERIFIED'
          : nextStatus === 'REJECTED' ? 'REJECTED' : 'PENDING'
      );
    } catch (err: any) {
      console.error('[AdminDashboard] Status change failed:', err?.message);
      setChangeError(err?.message || 'Status change failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const statusBadge = (s: VerificationStatus) => {
    if (isVerificationVerified(s)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200 shadow-sm">
          <XCircle className="w-3.5 h-3.5 text-red-500" /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
        <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending
      </span>
    );
  };

  return (
    <AdminAccessGate isAdmin={isAdmin}>
      <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Admin Dashboard — Contractor Verification & Project Oversight</h1>
            <Users className="w-7 h-7 text-terracotta" />
          </div>
          <p className="text-neutral-500 font-light text-sm max-w-3xl">
            Verify contractors, monitor project activity, and maintain platform quality.
          </p>
        </div>
        <button
          onClick={() => void loadContractors()}
          disabled={loading}
          className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} /> Refresh
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-2xl border px-5 py-3.5 text-sm font-semibold flex items-start gap-2.5 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-3">
        {([
          { value: 'PENDING', label: 'Pending' },
          { value: 'VERIFIED', label: 'Verified' },
          { value: 'REJECTED', label: 'Rejected' },
        ] as { value: AdminTab; label: string }[]).map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === tab.value
                ? tab.value === 'VERIFIED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : tab.value === 'REJECTED'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-amber-500 text-white shadow-sm'
                : 'border border-neutral-200 text-neutral-600 bg-white hover:bg-neutral-50'
            }`}
          >
            {tab.label}
            {contractors.length > 0 && activeTab === tab.value && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                {contractors.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-neutral-200 rounded w-2/3" />
                  <div className="h-3 bg-neutral-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-neutral-100 rounded w-full" />
              <div className="h-3 bg-neutral-100 rounded w-5/6" />
              <div className="h-8 bg-neutral-200 rounded-xl w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {!loading && error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadContractors()}
            className="px-3 py-1.5 bg-red-200 hover:bg-red-300 text-red-900 rounded-lg transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Empty State per tab */}
      {!loading && !error && contractors.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-3xl p-12 text-center space-y-4 shadow-premium">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-neutral-900 text-base">
            No {statusLabel(activeTab).toLowerCase()} contractors
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto font-light">
            {activeTab === 'PENDING'
              ? 'New contractor applications appear here as soon as they register.'
              : activeTab === 'VERIFIED'
                ? 'Approved contractors appear here and are eligible for customer recommendations.'
                : 'Rejected contractors and their rejection reasons appear here.'}
          </p>
        </div>
      )}
      {/* Contractor Cards */}
      {!loading && !error && contractors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractors.map(c => {
            const displayName = c.company_name || c.full_name || 'Unnamed Contractor';
            return (
              <div key={c.id} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-premium flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                    {displayName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-neutral-900 text-sm truncate">{displayName}</h3>
                    <p className="text-[11px] text-neutral-500 truncate">{c.full_name || '—'}</p>
                  </div>
                  {statusBadge(c.verification_status)}
                </div>

                <div className="space-y-1 text-[11px] text-neutral-600">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-neutral-400" /> {c.email || 'No email'}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" /> {c.phone || 'No phone'}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" /> {c.location || 'No location'}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                    {c.years_of_experience != null ? `${c.years_of_experience} years experience` : 'Experience not given'}
                  </p>
                </div>

                {c.skills && (
                  <p className="text-[10px] text-terracotta font-semibold truncate">{c.skills}</p>
                )}
                {c.rejection_reason && (
                  <p className="text-[10px] text-red-600 truncate">Reason: {c.rejection_reason}</p>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => void openDetails(c)}
                    className="px-3 py-1.5 rounded-xl border border-terracotta text-terracotta text-xs font-semibold hover:bg-terracotta-50 transition-all inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Details
                  </button>
                  {(c.resume_path || c.resume_url) && (
                    <button
                      type="button"
                      onClick={() => void openDetails(c)}
                      className="px-3 py-1.5 rounded-xl border border-neutral-200 text-neutral-600 text-xs font-semibold hover:bg-neutral-50 transition-all inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  {!isVerificationVerified(c.verification_status) && c.verification_status !== 'REJECTED' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleApprove(c)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Details Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeDetails}
          />
          <div className="relative bg-white max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 p-6 space-y-5">
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                  {(selected.company_name || selected.full_name || 'C').charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-neutral-900 text-lg truncate">
                    {selected.company_name || selected.full_name || 'Unnamed Contractor'}
                  </h2>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {selected.full_name || 'Contractor'} · {selected.email || 'No email'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(selected.verification_status)}
                <button
                  onClick={closeDetails}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contact / basics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-neutral-50 space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Email</span>
                <p className="text-xs font-semibold flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" /> {selected.email || '—'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-neutral-50 space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Phone</span>
                <p className="text-xs font-semibold flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" /> {selected.phone || '—'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-neutral-50 space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Location</span>
                <p className="text-xs font-semibold flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" /> {selected.location || '—'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-neutral-50 space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Experience</span>
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-neutral-400" />
                  {selected.years_of_experience != null ? `${selected.years_of_experience} years` : '—'}
                </p>
              </div>
            </div>

            {/* Previous projects / expertise */}
            {selected.project_types && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Previous Project Information
                </span>
                <p className="text-xs font-semibold text-terracotta bg-terracotta-50/40 p-3 rounded-xl border border-terracotta-100">
                  {selected.project_types}
                </p>
              </div>
            )}

            {selected.skills && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Skills</span>
                <p className="text-xs font-medium text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  {selected.skills}
                </p>
              </div>
            )}

            {selected.description && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Portfolio Information</span>
                <p className="text-xs text-neutral-600 font-light leading-relaxed bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
                  {selected.description}
                </p>
              </div>
            )}
            {/* Resume */}
            <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-2">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Resume</span>
              {resumeLoading ? (
                <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-terracotta" /> Generating secure link...
                </p>
              ) : resumeUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Resume available
                  </span>
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl border border-terracotta text-terracotta text-xs font-bold hover:bg-terracotta-50 transition-all inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View / Download
                  </a>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic">No resume uploaded.</p>
              )}
            </div>

            {/* Rejection reason */}
            {selected.verification_status === 'REJECTED' && selected.rejection_reason && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 space-y-1">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Rejection Reason</span>
                <p className="text-xs text-red-700 font-medium">{selected.rejection_reason}</p>
              </div>
            )}

            {/* Verification actions */}
            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Verification Actions</span>

              <div className="flex flex-wrap gap-2">
                {!isVerificationVerified(selected.verification_status) && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleApprove(selected)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve Contractor
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => {
                    setNextStatus('REJECTED');
                    setChangeError(null);
                    setChangeOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => {
                    setNextStatus(isVerificationVerified(selected.verification_status) ? 'PENDING' : 'VERIFIED');
                    setChangeError(null);
                    setChangeOpen(!changeOpen);
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-700 text-xs font-bold hover:bg-neutral-50 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowRight className="w-3.5 h-3.5" /> Change Status
                </button>
              </div>
              {/* Change status form */}
              {changeOpen && (
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Change verification status</label>
                  <select
                    value={nextStatus}
                    onChange={e => setNextStatus(e.target.value as 'VERIFIED' | 'REJECTED' | 'PENDING')}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-800 bg-white cursor-pointer"
                  >
                    <option value="VERIFIED">Verified (recommended to customers)</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="PENDING">Pending</option>
                  </select>

                  {nextStatus === 'REJECTED' && (
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Enter the rejection reason (shown to the contractor)..."
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-800 bg-white"
                    />
                  )}

                  {changeError && (
                    <p className="text-[11px] text-red-600">{changeError}</p>
                  )}

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleChangeStatus(selected)}
                    className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {actionBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Apply Status Change
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-100">
              <button
                onClick={closeDetails}
                className="px-5 py-2 rounded-xl bg-terracotta text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION 2: PROJECTS (Active / Completed)                      */}
      {/* ============================================================ */}
      <AdminProjectsSection />

      {/* ============================================================ */}
      {/* SECTION 4: MONITORING                                         */}
      {/* ============================================================ */}
      <AdminMonitoringSection />

      </div>
    </AdminAccessGate>
  );
};
