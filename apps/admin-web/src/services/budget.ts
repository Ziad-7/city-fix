import { http } from '@/lib/http';
import type { BudgetPlan } from '@/domain/admin-types';

export async function optimizeBudget(
  budgetEgp: number,
  incidentIds?: string[],
): Promise<BudgetPlan> {
  const data: { budgetEgp: number; incidentIds?: string[] } = { budgetEgp };
  if (incidentIds) data.incidentIds = incidentIds;
  const result = await http<BudgetPlan>('POST', '/admin/budget/optimize', data);
  if (!result) throw new Error('No budget plan returned');
  return result;
}

export async function commitBudgetPlan(incidentIds: string[]): Promise<{ id: string }[]> {
  const result = await http<{ id: string }[]>('POST', '/admin/budget/commit', { incidentIds });
  return result || [];
}
