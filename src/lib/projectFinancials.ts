import type { BudgetItem } from '../types/project';

/** projects.budget is INR; budget_items.estimated/spent are Lakhs. */
export function calculateProjectFinancials(
  budgetInr: number | null | undefined,
  items: Pick<BudgetItem, 'estimated' | 'spent'>[],
) {
  const originalBudget = Number(budgetInr ?? 0) / 100000;
  const spent = items.reduce((sum, item) => sum + Number(item.spent ?? 0), 0);
  const estimatedRemaining = items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.estimated ?? 0) - Number(item.spent ?? 0)), 0,
  );
  return {
    originalBudget,
    spent,
    remaining: Math.max(0, originalBudget - spent),
    overBudget: Math.max(0, spent - originalBudget),
    // Allocation-based forecast, not a progress-based completion prediction.
    estimatedFinalCost: items.length ? spent + estimatedRemaining : null,
  };
}

export function materialActualsInLakhs(items: { actual_cost: number }[]): number {
  // Sum in paise to avoid accumulating fractional currency errors.
  return items.reduce((sum, item) => sum + Math.round(Number(item.actual_cost ?? 0) * 100), 0) / 10000000;
}
