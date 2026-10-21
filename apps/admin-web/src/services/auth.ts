import { http } from '@/lib/http';
import type { StaffSession } from '@/domain/admin-types';

export async function staffLogin(email: string, password: string): Promise<StaffSession> {
  const result = await http<StaffSession>('POST', '/auth/staff-login', { email, password });
  if (!result) throw new Error('No session returned');
  return result;
}

export async function getMe(): Promise<StaffSession> {
  const result = await http<StaffSession>('GET', '/auth/me');
  if (!result) throw new Error('No session returned');
  return result;
}

export async function demoReset(): Promise<void> {
  await http('POST', '/admin/demo/reset');
}
