import { http } from '@/lib/http';
import type { StaffSession } from '@/domain/admin-types';

export async function staffLogin(email: string, password: string): Promise<StaffSession> {
  const result = await http<StaffSession>('POST', '/auth/staff-login', { email, password });
  return result as StaffSession;
}

export async function getMe(): Promise<StaffSession> {
  const result = await http<StaffSession>('GET', '/auth/me');
  return result as StaffSession;
}

export async function demoReset(): Promise<void> {
  await http<void>('POST', '/admin/demo/reset');
}
