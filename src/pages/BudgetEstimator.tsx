import { notifySpendingSaved } from '../services/projectFinancialService';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Check, Loader2, RefreshCw, Pencil, Trash2, Save, Wallet, AlertCircle } from 'lucide-react';
import { AiInsight } from '../components/AiInsight';
import { BudgetItem, Project } from '../types/project';
import {
  getBudgetItems,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
} from '../services/budgetService';
import { getProjectById, getProjectsByCustomer } from '../services/projectService';
import { saveEstimateToProject, applyBudgetToProject } from '../services/estimateService';
import { estimateMaterialCost, MaterialEstimate } from '../lib/materialRates';
import { useAuth } from '../context/AuthContext';

interface BudgetEstimatorProps {
  projectId?: string | null;
}

/** Safe numeric coercion — every derived rupee/percent flows through this so
 * the UI can never render NaN/Infinity/undefined. */
function safeNum(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** INR → Lakhs (budget_items are stored in Lakhs; the estimate engine in INR). */
const inrToLakhs = (inr: number): number => safeNum(inr) / 100000;
const fmtLakhs = (inr: number): string => `₹${inrToLakhs(inr).toFixed(2)} Lakhs`;

// ============================================================
// Preliminary allocation model — percentage weights applied to the
// CUSTOMER'S budget (falling back to the bottom-up estimate when no
// budget is saved). Weights are relative and renormalized to exactly
// 100%. `match` maps recorded expense entries (budget_items) to the
// category so actual spend rolls up without any new table.
// ============================================================
interface AllocContext {
  floors: number;
  bathrooms: number;
  premiumFloor: boolean;
  modularKitchen: boolean;
  landscape: boolean;
}
interface AllocationDef {
  name: string;
  weight: (ctx: AllocContext) => number;
  match: RegExp;
}
const ALLOC_DEFS: readonly AllocationDef[] = [
  { name: 'Site Preparation & Foundation', weight: () => 10, match: /foundation|site|plinth|excavat/i },
  { name: 'Structural Work', weight: (c) => 24 * (1 + 0.06 * (c.floors - 1)), match: /structur|rcc|column|beam/i },
  { name: 'Masonry / Walls', weight: () => 10, match: /masonr|wall|brick|block/i },
  { name: 'Roofing', weight: () => 8, match: /roof|terrace/i },
  { name: 'Electrical', weight: (c) => 7 * (1 + 0.04 * Math.max(0, c.bathrooms - 1)), match: /electric|wiring|points/i },
  { name: 'Plumbing & Sanitary', weight: (c) => 7 * (1 + 0.08 * Math.max(0, c.bathrooms - 1)), match: /plumb|sanitar|water/i },
  { name: 'Flooring & Tiles', weight: (c) => 8 * (c.premiumFloor ? 1.15 : 1), match: /floor|tile/i },
  { name: 'Doors & Windows', weight: () => 7, match: /door|window/i },
  { name: 'Kitchen', weight: (c) => 6 * (c.modularKitchen ? 1.2 : 1), match: /kitchen/i },
  { name: 'Painting & Finishing', weight: () => 6, match: /paint|finish|polish|putty/i },
  { name: 'Exterior / Landscaping', weight: (c) => 3 * (c.landscape ? 1.5 : 1), match: /exterior|landscape|garden|compound/i },
  { name: 'Labour / Miscellaneous Contingency', weight: () => 10, match: /labour|labor|misc|contingenc|wages|general/i },
];

export const BudgetEstimator: React.FC<BudgetEstimatorProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [budgetList, setBudgetList] = useState<BudgetItem[]>([]);
  const [budgetItemsUnavailable, setBudgetItemsUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [estimateSaving, setEstimateSaving] = useState(false);
  const [budgetApplying, setBudgetApplying] = useState(false);
  const [showOptimization, setShowOptimization] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'General', estimated: '', spent: '' });
  const msgTimer = useRef<number | null>(null);

  // ---- Project loading (same selection logic as the Materials page) -------
  // Uses the selected projectId when one is open; otherwise falls back to the
  // customer's most recently updated saved project — always scoped to the
  // authenticated user (projects.customer_id = auth.uid() via RLS), so the
  // page can never load another customer's project.
  const [fallbackProject, setFallbackProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId || !user) {
      setFallbackProject(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await getProjectsByCustomer(user.id);
        if (cancelled) return;
        const mostRecent =
          [...list].sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          )[0] ?? null;
        setFallbackProject(mostRecent);
      } catch (err) {
        if (!cancelled) {
          console.warn('[BudgetEstimator] fallback project load failed:', err);
          setFallbackProject(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const activeProjectId = projectId ?? fallbackProject?.id ?? null;

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) {
      setProject(null);
      setProjectError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setProjectLoading(true);
      setProjectError(null);
      try {
        const p = await getProjectById(activeProjectId);
        if (cancelled) return;
        setProject(p);
      } catch (err) {
        if (cancelled) return;
        console.warn('[BudgetEstimator] project load failed:', err);
        setProjectError(err instanceof Error ? err.message : String(err));
        setProject(null);
      } finally {
        if (!cancelled) setProjectLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  // ---- Recorded expense entries (existing public.budget_items ledger) ------
  const loadBudgetItems = useCallback(async (pid: string | null) => {
    if (!pid) {
      setBudgetList([]);
      setBudgetItemsUnavailable(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await getBudgetItems(pid);
      setBudgetList(items);
      setBudgetItemsUnavailable(false);
    } catch (err) {
      // A missing budget_items table must not blank the page: actuals show
      // ₹0.00 + "No expense entries recorded yet" while the estimate works.
      console.warn('[BudgetEstimator] expense ledger unavailable:', err);
      setBudgetList([]);
      setBudgetItemsUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBudgetItems(activeProjectId);
  }, [loadBudgetItems, activeProjectId]);

  // Success feedback auto-clears after 5s (the app has no toast system).
  const flash = useCallback((msg: string) => {
    setSuccessMsg(msg);
    if (msgTimer.current) window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setSuccessMsg(null), 5000);
  }, []);
  useEffect(
    () => () => {
      if (msgTimer.current) window.clearTimeout(msgTimer.current);
    },
    [],
  );

  // ---- Customer budget (Part 2 priority: budget → budget_max → budget_min) --
  const customerBudget = useMemo(() => {
    if (!project) return null;
    const b = safeNum(project.budget);
    if (b > 0) return b;
    const bmax = safeNum(project.budget_max);
    if (bmax > 0) return bmax;
    const bmin = safeNum(project.budget_min);
    if (bmin > 0) return bmin;
    return null;
  }, [project]);

  // Customer's acceptable range (both bounds given) — displayed, never added.
  const budgetRange = useMemo(() => {
    if (!project) return null;
    const bmin = safeNum(project.budget_min);
    const bmax = safeNum(project.budget_max);
    return bmin > 0 && bmax > 0 ? { min: bmin, max: bmax } : null;
  }, [project]);

  // ---- Bottom-up estimate: the SAME engine as the Materials page ------------
  const estimate: MaterialEstimate | null = useMemo(() => {
    if (!project) return null;
    return estimateMaterialCost({
      city: project.city,
      state: project.state,
      project_type: project.project_type,
      building_type: project.building_type,
      built_up_area: project.built_up_area,
      floors: project.floors,
      bedrooms: project.bedrooms,
      bathrooms: project.bathrooms,
      preferred_materials: project.preferred_materials,
      material_preference: project.material_preference,
      sustainability_preference: project.sustainability_preference,
      kitchen_type: project.kitchen_type,
      parking: project.parking,
      requirements: project.requirements,
    });
  }, [project]);

  // ---- Percentage allocation of the customer's budget ------------------------
  const allocations = useMemo(() => {
    if (!project || !estimate) return [];
    const floors = Math.max(1, Math.round(safeNum(project.floors) || 1));
    const bathrooms = Math.max(0, Math.round(safeNum(project.bathrooms) || 0));
    const prefText = [project.preferred_materials, project.material_preference]
      .filter(Boolean)
      .join(' ');
    const ctx: AllocContext = {
      floors,
      bathrooms,
      premiumFloor: /marble|granite|wood|laminate/i.test(prefText),
      modularKitchen: /modular/i.test(project.kitchen_type ?? ''),
      landscape: /garden|landscape|lawn/i.test(project.requirements ?? ''),
    };
    // Planning base: the CUSTOMER'S budget. When none is saved yet, fall back
    // to the bottom-up estimate — the UI labels this clearly.
    const baseInr = customerBudget ?? estimate.estimatedProjectBudget;
    const weights = ALLOC_DEFS.map((d) => Math.max(0.5, d.weight(ctx)));
    const wSum = weights.reduce((a, b) => a + b, 0);
    const planned = ALLOC_DEFS.map((d, i) => ({ def: d, pct: (weights[i] / wSum) * 100 }));
    for (const p of planned) p.pct = Math.round(p.pct);
    const drift = 100 - planned.reduce((a, p) => a + p.pct, 0);
    if (drift !== 0) {
      const largest = planned.reduce((a, b) => (b.pct > a.pct ? b : a));
      largest.pct = Math.max(1, largest.pct + drift);
    }
    return planned.map((p) => ({
      name: p.def.name,
      match: p.def.match,
      pct: p.pct,
      amountInr: Math.round((baseInr * p.pct) / 100),
    }));
  }, [project, estimate, customerBudget]);

  // ---- Actual spend mapped onto allocation categories (no new tables) ------
  const ledgerRows = useMemo(() => {
    const matched = new Map<string, { spent: number; count: number }>();
    const unmatched: BudgetItem[] = [];
    for (const item of budgetList) {
      const hay = `${item.name} ${item.category}`;
      const row = allocations.find((a) => a.match.test(hay));
      if (row) {
        const cur = matched.get(row.name) ?? { spent: 0, count: 0 };
        cur.spent += safeNum(item.spent);
        cur.count += 1;
        matched.set(row.name, cur);
      } else {
        unmatched.push(item);
      }
    }
    const rows = allocations.map((a) => {
      const m = matched.get(a.name);
      return {
        name: a.name,
        pct: a.pct,
        estimatedL: inrToLakhs(a.amountInr),
        actualL: m ? m.spent : 0,
        entryCount: m?.count ?? 0,
      };
    });
    if (unmatched.length > 0) {
      rows.push({
        name: 'Other recorded entries',
        pct: 0,
        estimatedL: unmatched.reduce((a, i) => a + safeNum(i.estimated), 0),
        actualL: unmatched.reduce((a, i) => a + safeNum(i.spent), 0),
        entryCount: unmatched.length,
      });
    }
    return rows;
  }, [allocations, budgetList]);

  const actualSpentL = useMemo(
    () => budgetList.reduce((a, i) => a + safeNum(i.spent), 0),
    [budgetList],
  );
  const targetBudgetL = customerBudget != null ? inrToLakhs(customerBudget) : null;
  const remainingL = targetBudgetL != null ? targetBudgetL - actualSpentL : null;
  // Guarded: 0 when there is no target (never NaN/Infinity).
  const spentPct =
    targetBudgetL != null && targetBudgetL > 0
      ? Math.max(0, Math.min(999, Math.round((actualSpentL / targetBudgetL) * 100)))
      : 0;

  // ---- Budget status: bottom-up estimate vs the customer's budget ------------
  const budgetStatus = useMemo(() => {
    if (!estimate) return null;
    const estPoint = estimate.estimatedProjectBudget;
    if (targetBudgetL == null) {
      return {
        tone: 'neutral' as const,
        title: 'BUDGET NOT SET',
        lines: [
          `Estimated project cost: ${fmtLakhs(estPoint)}`,
          'Set a customer budget (or apply this estimate) to unlock variance tracking.',
        ],
      };
    }
    const diffL = targetBudgetL - inrToLakhs(estPoint);
    const tol = targetBudgetL * 0.05;
    if (diffL >= tol) {
      return {
        tone: 'under' as const,
        title: 'UNDER BUDGET',
        lines: [
          `Estimated project cost: ${fmtLakhs(estPoint)}`,
          `Customer budget: ${fmtLakhs(targetBudgetL * 100000)}`,
          `Remaining planning buffer: ₹${diffL.toFixed(1)}L`,
        ],
      };
    }
    if (diffL <= -tol) {
      return {
        tone: 'over' as const,
        title: 'OVER BUDGET',
        lines: [
          `Estimated project cost: ${fmtLakhs(estPoint)}`,
          `Customer budget: ${fmtLakhs(targetBudgetL * 100000)}`,
          `Over by: ₹${Math.abs(diffL).toFixed(1)}L — trim finishing scope or phase the work.`,
        ],
      };
    }
    return {
      tone: 'within' as const,
      title: 'WITHIN BUDGET',
      lines: [`Estimated: ${fmtLakhs(estPoint)}`, `Budget: ${fmtLakhs(targetBudgetL * 100000)}`],
    };
  }, [estimate, targetBudgetL, customerBudget]);

  // ---- Optimization suggestions — CALCULATED from the project's own estimate
  // lines. Rupee savings appear ONLY when the project data supports them;
  // otherwise the card shows "Review required" with no invented amount.
  const optimizations = useMemo(() => {
    if (!estimate || !project) return [];
    const lines = estimate.categories.flatMap((g) => g.items);
    const altRate = Math.round(85 * estimate.location.multiplier); // engine's vitrified rate
    const out: { title: string; savingL: number | null; reason: string; tone: 'save' | 'info' }[] = [];

    // 1) Premium stone → vitrified alternative (only when marble is selected).
    const marbleLines = lines.filter((l) => /marble/i.test(l.name));
    const marbleSaving = marbleLines.reduce(
      (a, l) => a + Math.max(0, l.unit_rate - altRate) * l.quantity,
      0,
    );
    if (marbleSaving > 0) {
      out.push({
        title: 'Vitrified tiles instead of marble flooring',
        savingL: inrToLakhs(marbleSaving),
        tone: 'save',
        reason: `Calculated from your own flooring selection (${marbleLines
          .map((l) => `${Math.round(l.quantity).toLocaleString('en-IN')} sq ft @ ₹${l.unit_rate}`)
          .join(', ')}) against the engine's vitrified rate of ₹${altRate}/sq ft. Indicative.`,
      });
    }

    // 2) Bulk steel procurement (only when the steel line is substantial).
    const steel = lines.find((l) => /steel/i.test(l.name));
    if (steel && steel.cost >= 200000) {
      out.push({
        title: 'Bulk TMT steel procurement',
        savingL: inrToLakhs(steel.cost * 0.04),
        tone: 'save',
        reason: `Your ${Math.round(steel.quantity).toLocaleString('en-IN')} kg requirement (₹${steel.cost.toLocaleString('en-IN')}) qualifies for a typical ≈4% bulk-order discount. Indicative.`,
      });
    }

    // 3) AAC eco-blocks (only when the walling line is conventional bricks).
    const bricks = lines.find((l) => /brick/i.test(l.name) && !/aac/i.test(l.name));
    if (bricks && bricks.cost >= 100000) {
      out.push({
        title: 'AAC eco-block substitution',
        savingL: inrToLakhs(bricks.cost * 0.12),
        tone: 'save',
        reason: `AAC blocks cut mortar, plaster volume and structural load on your ₹${bricks.cost.toLocaleString('en-IN')} walling package — indicative ≈12%.`,
      });
    }

    // 4) Sustainability alignment — informational, never a fake rupee saving.
    const sustain = [project.sustainability_preference, project.requirements]
      .filter(Boolean)
      .join(' ');
    if (/solar|rain.?water|harvest|eco|sustain|green/i.test(sustain)) {
      out.push({
        title: 'Sustainable options already planned',
        savingL: null,
        tone: 'info',
        reason: 'Your sustainability preference is reflected in the estimate (solar-ready / rainwater provisions where applicable). Confirm final specs with your contractor.',
      });
    } else {
      out.push({
        title: 'Rainwater harvesting review',
        savingL: null,
        tone: 'info',
        reason: 'Potential saving — review required. Several municipalities offer rebates, and it reduces water-tanker spend during construction.',
      });
    }
    return out;
  }, [estimate, project]);

  const resetForm = () => {
    setForm({ name: '', category: 'General', estimated: '', spent: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  // ---- Save estimate (Part 11): persists the allocation into the existing
  // budget_items ledger (category 'Preliminary Estimate'). The customer's own
  // budget/budget_min/budget_max are NEVER overwritten by this button — unless
  // no budget exists at all, in which case the calculated estimate is written
  // so Target Budget stops being "not set".
  const handleSaveEstimate = async () => {
    if (!project || !estimate) {
      setError('Load a project first to save the estimate.');
      return;
    }
    setEstimateSaving(true);
    setError(null);
    try {
      await saveEstimateToProject(project.id, estimate);
      if (customerBudget == null) {
        await applyBudgetToProject(project.id, estimate);
        setProject(await getProjectById(project.id));
        flash('✓ Budget estimate saved — no customer budget was set, so the calculated estimate was also written to the project budget.');
      } else {
        flash('✓ Budget estimate saved — your customer budget was preserved.');
      }
      await loadBudgetItems(project.id);
    } catch (err) {
      console.error('[BudgetEstimator] save estimate failed:', err);
      setError('Could not save budget estimate. Please try again.');
    } finally {
      setEstimateSaving(false);
    }
  };

  // ---- Apply budget (Part 12): EXPLICITLY writes the calculated estimate into
  // the existing projects.budget / budget_min / budget_max fields (the same
  // fields the Materials page uses), then refreshes the project row so Target
  // Budget, Remaining Balance, Ledger and Status update immediately.
  const handleApplyBudget = async () => {
    if (!project || !estimate) {
      setError('Load a project first to apply the budget.');
      return;
    }
    if (project.budget != null) {
      setError('Original budget is preserved. Use Save estimate to update current estimated costs instead.');
      return;
    }
    setBudgetApplying(true);
    setError(null);
    try {
      const updated = await applyBudgetToProject(project.id, estimate);
      setProject(updated);
      flash('✓ Budget applied successfully — your project budget has been updated.');
    } catch (err) {
      console.error('[BudgetEstimator] apply budget failed:', err);
      setError('Could not apply budget estimate. Please try again.');
    } finally {
      setBudgetApplying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !form.name.trim() || saving) return;
    const estimated = Number(form.estimated);
    const spent = Number(form.spent);
    if (![estimated, spent].every(value => Number.isFinite(value) && value >= 0)) {
      setError('Estimated and recorded spending must be finite, non-negative amounts in Lakhs.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const existing = budgetList.find(item => item.id === editingId);
      if (existing?.name.trim().toLowerCase() === 'material cost' &&
          (spent !== Number(existing.spent) || form.name.trim() !== existing.name)) {
        throw new Error('Material Cost spending is synchronized from Materials. Use Record actual there; keep this budget item name unchanged.');
      }
      if (!editingId && form.name.trim().toLowerCase() === 'material cost' &&
          budgetList.some(item => item.name.trim().toLowerCase() === 'material cost')) {
        throw new Error('A Material Cost budget item already exists. Record material spending on the Materials page.');
      }
      const payload = {
        name: form.name.trim(),
        category: form.category || 'General',
        estimated,
        spent,
      };
      if (editingId) {
        await updateBudgetItem(editingId, payload);
      } else {
        await createBudgetItem({ project_id: activeProjectId, ...payload });
      }
      resetForm();
      await loadBudgetItems(activeProjectId);
      notifySpendingSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      estimated: String(item.estimated),
      spent: String(item.spent),
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (budgetList.find(item => item.id === id)?.name.trim().toLowerCase() === 'material cost') {
      setError('The Material Cost budget item is linked to recorded materials and cannot be deleted here.');
      return;
    }
    if (!window.confirm('Delete this budget item?')) return;
    setSaving(true);
    try {
      await deleteBudgetItem(id);
      await loadBudgetItems(activeProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">AI Budget Estimator</h1>
          <p className="text-neutral-500 font-light mt-1">
            Smart budget estimate built from your saved project — preliminary planning figures, not a quotation.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeProjectId && (
            <button
              onClick={() => void loadBudgetItems(activeProjectId)}
              disabled={loading}
              className="p-2 border border-neutral-200 hover:border-neutral-400 bg-white rounded-xl transition-all disabled:opacity-50"
              title="Refresh budget"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-neutral-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {activeProjectId && (
            <button
              onClick={() => { setShowAddForm((v) => !v); setEditingId(null); setForm({ name: '', category: 'General', estimated: '', spent: '' }); }}
              className="px-4 py-2 bg-terracotta hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> {showAddForm ? 'Close' : 'Add Expense'}
            </button>
          )}
          {project && estimate && (
            <>
              <button
                onClick={() => void handleSaveEstimate()}
                disabled={estimateSaving || budgetApplying}
                className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Persist this estimate as the project's budget ledger (customer budget is preserved)"
              >
                {estimateSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {estimateSaving ? 'Saving...' : 'Save estimate to project'}
              </button>
              <button
                onClick={() => void handleApplyBudget()}
                disabled={estimateSaving || budgetApplying}
                className="px-4 py-2 bg-white hover:bg-neutral-50 disabled:opacity-40 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Write the calculated estimate into the project's saved budget"
              >
                {budgetApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                {budgetApplying ? 'Applying...' : 'Apply budget to project'}
              </button>
            </>
          )}
          <span className="text-xs text-neutral-400 font-bold">Preliminary estimate</span>
          <span className="text-xs font-extrabold text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded">Regional rates may vary</span>
        </div>
      </div>

      {/* Add / Edit form */}
      {showAddForm && projectId && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4"
        >
          <h3 className="text-base font-bold text-neutral-900">
            {editingId ? 'Edit Budget Item' : 'Add Budget Item'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Foundation"
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Materials, Labour, Other"
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Estimated (Lakhs)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.estimated}
                onChange={(e) => setForm((f) => ({ ...f, estimated: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Recorded total spent (Lakhs)</label>
              <p className="text-xs text-neutral-500 mb-2">Explicit material, labour, or other spending only. ₹1 lakh = ₹100,000. Editing replaces this row’s total, not an additional payment.</p>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.spent}
                onChange={(e) => setForm((f) => ({ ...f, spent: e.target.value }))}
                placeholder="0.00"
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
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editingId ? 'Update' : 'Save'} Item
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading budget…
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700 flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {budgetItemsUnavailable && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">
          Expense ledger storage (budget_items) is not available on this database yet — actual spending shows ₹0.00 and tracking is disabled, but the estimate above still works. Ask the administrator to run supabase/migrations/20260908200000_phase11_budget_material_management.sql.
        </div>
      )}
      {projectLoading && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading saved project…
        </div>
      )}
      {projectError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800">
          Could not load your saved project: {projectError}
        </div>
      )}
      {!projectLoading && !project && !projectError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-semibold text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>No saved project found yet — save your project details (including budget) and this page will build the budget allocation automatically.</span>
        </div>
      )}

      {/* Totals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neutral-50 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Target Budget</span>
          <div className="text-3xl font-extrabold text-neutral-900 mt-2">
            {targetBudgetL != null ? `₹${targetBudgetL.toFixed(2)} Lakhs` : <span className="text-neutral-400 text-2xl">Budget not set</span>}
          </div>
          <div className="text-xs text-neutral-400 mt-2 font-light">
            {budgetRange
              ? `Budget Range ₹${inrToLakhs(budgetRange.min).toFixed(1)}L – ₹${inrToLakhs(budgetRange.max).toFixed(1)}L`
              : project
                ? customerBudget != null
                  ? 'Customer budget from your saved project'
                  : 'No budget saved — allocation uses the preliminary estimate'
                : '—'}
          </div>
        </div>

        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50/20 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Actual Spent-to-Date</span>
          <div className="text-3xl font-extrabold text-red-500 mt-2">₹{actualSpentL.toFixed(2)} Lakhs</div>
          <div className="text-xs text-neutral-400 mt-2 font-light">
            {budgetList.length > 0
              ? `${spentPct}% of target budget spent`
              : 'No expense entries recorded yet'}
          </div>
        </div>

        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/20 rounded-bl-full pointer-events-none" />
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Remaining Balance</span>
          <div className={`text-3xl font-extrabold mt-2 ${remainingL != null && remainingL < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {remainingL != null ? `₹${remainingL.toFixed(2)} Lakhs` : '—'}
          </div>
          <div className="text-xs text-neutral-400 mt-2 font-light">
            {remainingL != null
              ? remainingL < 0
                ? 'Overdrawn — recorded expenses exceed the target budget'
                : budgetList.length > 0
                  ? 'Target budget minus recorded expenses'
                  : 'No expenses recorded against this budget yet'
              : 'Set a customer budget to track the balance'}
          </div>
        </div>
      </div>

      {/* Budget status banner — dynamically calculated from estimate vs budget */}
      {budgetStatus && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-start gap-2 ${
            budgetStatus.tone === 'over'
              ? 'bg-red-50 border-red-100 text-red-700'
              : budgetStatus.tone === 'under'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : budgetStatus.tone === 'within'
                  ? 'bg-blue-50 border-blue-100 text-blue-700'
                  : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-extrabold uppercase tracking-wide">{budgetStatus.title}</span>
            <span className="mx-2 text-neutral-300">|</span>
            {budgetStatus.lines.join('  ')}
          </div>
        </div>
      )}

      {/* Main ledger & SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Ledger */}
        <div className="lg:col-span-8 bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-900">Detailed Ledger Breakdown</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {allocations.length > 0
                ? `Allocation of ${targetBudgetL != null ? 'your saved budget' : 'the preliminary estimate'} across construction stages — preliminary estimate, regional rates may vary.`
                : 'Load a saved project to build the allocation.'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 font-semibold">
                  <th className="pb-3 pr-4 font-bold text-xs uppercase">Category</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Estimated Cost</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Actual Spent</th>
                  <th className="pb-3 px-4 font-bold text-xs uppercase text-right">Progress Variance</th>
                  <th className="pb-3 pl-4 font-bold text-xs uppercase text-right">Burn Indicator</th>
                  <th className="pb-3 pl-4 font-bold text-xs uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {ledgerRows.map((row) => {
                  const burn = row.estimatedL > 0 ? Math.min(100, Math.round((row.actualL / row.estimatedL) * 100)) : 0;
                  const isOver = row.estimatedL > 0 && row.actualL > row.estimatedL;
                  const variance = row.estimatedL - row.actualL;
                  const status = row.actualL <= 0 ? 'Not started' : isOver ? 'Over' : burn >= 90 ? 'Near limit' : 'On track';
                  return (
                    <tr key={row.name} className="text-neutral-800 font-semibold">
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-neutral-900">{row.name}</div>
                        {row.pct > 0 && (
                          <span className="text-[10px] text-neutral-400 font-bold uppercase">{row.pct}% of budget</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">₹{row.estimatedL.toFixed(2)}L</td>
                      <td className="py-3.5 px-4 text-right text-neutral-700">
                        ₹{row.actualL.toFixed(2)}L
                        {row.entryCount === 0 && (
                          <div className="text-[10px] text-neutral-400 font-light">No expense entries</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                          isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {isOver ? `+₹${Math.abs(variance).toFixed(2)}L over` : `₹${variance.toFixed(2)}L left`}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            status === 'Over'
                              ? 'bg-red-50 text-red-600'
                              : status === 'Near limit'
                                ? 'bg-amber-50 text-amber-700'
                                : status === 'On track'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-neutral-100 text-neutral-500'
                          }`}>{status}</span>
                          <div className="w-16 bg-neutral-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-terracotta'}`}
                              style={{ width: `${burn}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <button
                          onClick={() => { setEditingId(null); setForm({ name: row.name, category: 'Expense', estimated: '', spent: '' }); setShowAddForm(true); }}
                          className="p-1.5 rounded-lg border border-neutral-200 hover:border-terracotta hover:text-terracotta transition-all"
                          title="Add an expense entry for this category"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {ledgerRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400 text-sm">
                      {projectLoading ? 'Loading project…' : 'Load a saved project to populate the ledger.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {budgetList.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Recorded expense entries ({budgetList.length})
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-neutral-100">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-400 font-semibold">
                      <th className="py-2 pr-3 font-bold uppercase">Entry</th>
                      <th className="py-2 px-3 font-bold uppercase">Category</th>
                      <th className="py-2 px-3 font-bold uppercase text-right">Estimated (L)</th>
                      <th className="py-2 px-3 font-bold uppercase text-right">Spent (L)</th>
                      <th className="py-2 pl-3 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {budgetList.map((item) => (
                      <tr key={item.id} className="text-neutral-700 font-semibold">
                        <td className="py-2.5 pr-3">{item.name}</td>
                        <td className="py-2.5 px-3 text-neutral-500">{item.category}</td>
                        <td className="py-2.5 px-3 text-right">{safeNum(item.estimated).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right">{safeNum(item.spent).toFixed(2)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 rounded-lg border border-neutral-200 hover:border-terracotta hover:text-terracotta transition-all"
                              title="Edit entry"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => void handleDelete(item.id)}
                              className="p-1.5 rounded-lg border border-neutral-200 hover:border-red-400 hover:text-red-500 transition-all"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Charts & Optimization */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Estimated Allocation — percentages of the planning base, total 100% */}
          <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 shadow-premium space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Estimated Allocation</h3>
            <p className="text-[10px] text-neutral-400 font-light -mt-2">
              {targetBudgetL != null
                ? `Allocation of your ₹${targetBudgetL.toFixed(2)}L budget`
                : 'Allocation of the preliminary estimate (no customer budget saved)'}
            </p>
            <div className="flex flex-col gap-3">
              {allocations.map((a) => (
                <div key={a.name} className="space-y-1">
                  <div className="flex justify-between text-xs text-neutral-700 font-bold">
                    <span>{a.name}</span>
                    <span>{a.pct}% · ₹{(a.amountInr / 100000).toFixed(2)}L</span>
                  </div>
                  <div className="w-full bg-neutral-50 h-3 rounded-md overflow-hidden border border-neutral-100">
                    <div
                      className="h-full bg-terracotta/80 rounded-md"
                      style={{ width: `${a.pct}%` }}
                    />
                  </div>
                </div>
              ))}
              {allocations.length > 0 && (
                <div className="flex justify-between text-[10px] text-neutral-400 font-bold uppercase pt-1 border-t border-neutral-100">
                  <span>Total</span>
                  <span>
                    100% · ₹{(allocations.reduce((acc, a) => acc + a.amountInr, 0) / 100000).toFixed(2)}L
                  </span>
                </div>
              )}
              {allocations.length === 0 && (
                <p className="text-xs text-neutral-400 font-light">Load a saved project to see the allocation.</p>
              )}
            </div>
          </div>

          {/* AI Optimizations card */}
          {showOptimization && (
            <div className="bg-white border-2 border-terracotta rounded-3xl p-6 shadow-premium space-y-4 relative overflow-hidden ai-border-glow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-terracotta-50 to-transparent opacity-50 rounded-full blur-xl pointer-events-none" />
              <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-terracotta animate-pulse" /> AI Budget Optimization
              </h3>

              <div className="space-y-3">
                {optimizations.map((opt, idx) => (
                  <div key={idx} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-neutral-800 text-xs">{opt.title}</h4>
                      {opt.savingL != null ? (
                        <span className="text-emerald-600 font-bold text-xs flex-shrink-0">
                          -₹{opt.savingL.toFixed(2)} Lakhs
                        </span>
                      ) : (
                        <span className="text-neutral-500 font-bold text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          Review required
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 font-light mt-1 leading-relaxed">
                      {opt.reason}
                    </p>
                  </div>
                ))}
                {optimizations.length === 0 && (
                  <p className="text-xs text-neutral-400 font-light">
                    No optimizations applicable — your saved project configuration already reflects your preferences.
                  </p>
                )}
                <p className="text-[10px] text-neutral-400 font-light pt-1 border-t border-neutral-100">
                  Suggestions are calculated from your project's own estimate lines — indicative figures, not vendor quotations.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {estimate && (
        <AiInsight
          insight={
            budgetStatus
              ? `${budgetStatus.title}: ${budgetStatus.lines.join(' — ')}`
              : 'Load a saved project to generate the budget outlook.'
          }
          recommendation={`Preliminary estimate ${fmtLakhs(estimate.estimatedProjectBudget)} (range ₹${(estimate.estimatedBudgetMin / 100000).toFixed(1)}L–₹${(estimate.estimatedBudgetMax / 100000).toFixed(1)}L) at ${estimate.location.labelSuffix}. Heuristic calculation from your saved project inputs — not an AI model and not a quotation.`}
          confidenceScore={80}
          impactValue={
            remainingL != null
              ? `₹${Math.abs(remainingL).toFixed(1)}L ${remainingL >= 0 ? 'buffer' : 'overdrawn'}`
              : 'Set a budget'
          }
        />
      )}
    </div>
  );
};
