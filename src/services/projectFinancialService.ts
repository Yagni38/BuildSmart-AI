import { supabase } from '../lib/supabase';
import { calculateProjectFinancials } from '../lib/projectFinancials';
import { getBudgetItems } from './budgetService';

const EVENT = 'buildsmart-spending-saved';

export async function getProjectFinancials(projectId: string) {
  const [project, items] = await Promise.all([
    supabase.from('projects').select('budget').eq('id', projectId).single(),
    getBudgetItems(projectId),
  ]);
  if (project.error) throw new Error(project.error.message);
  return { ...calculateProjectFinancials(project.data.budget, items), items };
}

export function notifySpendingSaved() {
  window.dispatchEvent(new Event(EVENT));
  // Notify other tabs without transferring project data or requiring Realtime setup.
  try { localStorage.setItem(EVENT, `${Date.now()}-${Math.random()}`); } catch { /* Focus/poll refresh still works. */ }
}

export function subscribeToSpending(refresh: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === EVENT) refresh(); };
  window.addEventListener('focus', refresh);
  window.addEventListener(EVENT, refresh);
  window.addEventListener('storage', onStorage);
  // Also refresh other signed-in browsers without changing Supabase publication settings.
  const timer = window.setInterval(refresh, 30000);
  return () => {
    window.removeEventListener('focus', refresh);
    window.removeEventListener(EVENT, refresh);
    window.removeEventListener('storage', onStorage);
    window.clearInterval(timer);
  };
}
