import { http } from '@/lib/http';
import type { Department, Team } from '@/domain/admin-types';

export async function getDepartments(): Promise<Department[]> {
  const result = await http<Department[]>('GET', '/admin/departments');
  return result || [];
}

export async function getTeams(): Promise<Team[]> {
  const result = await http<Team[]>('GET', '/admin/teams');
  return result || [];
}
