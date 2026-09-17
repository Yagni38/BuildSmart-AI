import React, { useEffect, useState } from 'react';
import { Building2, Pencil, RefreshCw } from 'lucide-react';
import { ConstructionMaterial } from '../types/project';
import { getMaterials, recordMaterialActual } from '../services/materialService';
import { subscribeToSpending } from '../services/projectFinancialService';
import { useAuth } from '../context/AuthContext';
import { getProjectById, getProjectsByCustomer } from '../services/projectService';
import { estimateMaterialCost } from '../lib/materialRates';
import { saveEstimateToProject } from '../services/estimateService';

interface MaterialEstimatorProps { projectId?: string | null; }

export const MaterialEstimator: React.FC<MaterialEstimatorProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<ConstructionMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMaterials([]);
    setEditingId(null);
    setError(null);
    setMessage(null);
    const load = async () => {
      try {
        const id = projectId ?? (user ? (await getProjectsByCustomer(user.id))[0]?.id : null);
        const rows = id ? await getMaterials(id) : [];
        if (!cancelled) setMaterials(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load materials.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId, user?.id, revision]);

  useEffect(() => subscribeToSpending(() => {
    if (!saving && !editingId) setRevision(value => value + 1);
  }), [saving, editingId]);

  const saveActualCost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId || saving) return;
    const amount = Number(actualCost);
    if (!actualCost.trim() || !Number.isFinite(amount) || amount < 0) {
      setError('Enter a finite, non-negative actual cost in INR.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const material = materials.find(row => row.id === editingId);
      if (!material) throw new Error('Select a saved material first.');
      const saved = await recordMaterialActual(material.project_id, editingId, amount);
      setMaterials(saved.materials);
      setEditingId(null);
      setMessage('Material actual and project spending saved and read back from Supabase.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save actual cost.');
    } finally {
      setSaving(false);
    }
  };

  const refreshLocationEstimate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const id = projectId ?? (user ? (await getProjectsByCustomer(user.id))[0]?.id : null);
      if (!id) throw new Error('Select an existing project first.');
      const project = await getProjectById(id);
      if (!project) throw new Error('Project not found.');
      const saved = await saveEstimateToProject(id, estimateMaterialCost(project));
      setMaterials(saved.materials);
      setMessage('Location-adjusted estimates saved. Historical actual costs and original budget are unchanged.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh estimates.');
    } finally { setSaving(false); }
  };

  const totalActual = materials.reduce((sum, row) => sum + Number(row.actual_cost ?? 0), 0);
  const inr = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><Building2 /> Material Estimator</h1>
        <button onClick={() => setRevision(value => value + 1)} disabled={loading || saving} aria-label="Refresh saved materials"><RefreshCw /></button>
      </div>
      <p className="text-sm text-neutral-500">Recorded material costs are included in project spending. Record the total paid in INR, not an estimate or progress percentage. Re-estimating in Budget Estimator uses the project location and preserves recorded actual costs.</p>
      <button onClick={refreshLocationEstimate} disabled={loading || saving || !!editingId} className="border rounded-xl px-4 py-2">Refresh estimates from saved project location</button>
      {error && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl">{error}</p>}
      {message && <p role="status" className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">{message}</p>}
      {loading && <p>Loading saved materials…</p>}
      {!loading && !error && materials.length === 0 && <p>No saved materials. Save a project estimate in Budget Estimator first.</p>}
      {!loading && !error && <p className="font-bold">Recorded material actuals: {inr(totalActual)}</p>}

      <div className="bg-white border rounded-2xl p-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th>Material</th><th>Quantity</th><th>Estimate (INR)</th><th>Actual (INR)</th><th>Action</th></tr></thead>
          <tbody>{materials.map(row => (
            <tr key={row.id} className="border-b">
              <td className="py-3">{row.name}</td><td>{row.quantity} {row.unit}</td>
              <td>{inr(Number(row.estimated_cost ?? 0))}</td><td>{inr(Number(row.actual_cost ?? 0))}</td>
              <td><button disabled={saving} onClick={() => {
                setEditingId(row.id); setActualCost(String(row.actual_cost ?? 0)); setError(null); setMessage(null);
              }} className="flex items-center gap-1 text-terracotta"><Pencil className="w-4 h-4" /> Record actual</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {editingId && (
        <form onSubmit={saveActualCost} className="p-5 bg-white border rounded-2xl space-y-3">
          <label htmlFor="material-actual" className="block font-semibold">Total paid for {materials.find(row => row.id === editingId)?.name} (INR)</label>
          <input id="material-actual" type="number" min="0" step="0.01" required value={actualCost}
            disabled={saving} onChange={event => setActualCost(event.target.value)} className="border rounded-xl p-2" />
          <p className="text-xs text-neutral-500">Replaces the saved actual total; does not add a transaction.</p>
          <button type="submit" disabled={saving} className="bg-terracotta text-white rounded-xl px-4 py-2">{saving ? 'Saving…' : 'Save actual cost'}</button>
          <button type="button" disabled={saving} onClick={() => setEditingId(null)} className="ml-3 border rounded-xl px-4 py-2">Cancel</button>
        </form>
      )}
    </div>
  );
};
