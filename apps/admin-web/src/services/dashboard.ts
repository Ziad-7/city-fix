import { http } from '@/lib/http';
import type { DashboardStats, Insights } from '@/domain/admin-types';

export async function getDashboard(range?: 'today' | '7d' | '30d'): Promise<DashboardStats> {
  const qs = range ? `?range=${range}` : '';
  const result = await http<DashboardStats>('GET', `/admin/dashboard${qs}`);
  if (!result) throw new Error('No dashboard stats returned');
  return result;
}

export async function getInsights(): Promise<Insights> {
  const result = await http<Insights>('GET', '/admin/insights');
  if (!result) throw new Error('No insights returned');
  return result;
}
