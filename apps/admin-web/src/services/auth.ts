import { http } from '@/lib/http';
import type { StaffSession } from '@/domain/admin-types';

interface StaffAuthResponse {
  userId: string;
  name?: string | null;
  role: 'staff' | 'admin';
  departmentId?: string;
  district: string;
  token: string;
}

function toAdminSession(session: StaffAuthResponse): StaffSession {
  const department = session.departmentId;
  return {
    ...session,
    name: session.name || 'موظف',
    title:
      session.role === 'admin'
        ? 'مشرفة فرز · حي مدينة نصر'
        : department
          ? `موظف · ${department}`
          : 'موظف',
    department,
  };
}

export async function staffLogin(email: string, password: string): Promise<StaffSession> {
  const result = await http<StaffAuthResponse>('POST', '/auth/staff-login', { email, password });
  if (!result) throw new Error('بيانات جلسة الموظف غير متاحة');
  return toAdminSession(result);
}

export async function getMe(): Promise<StaffSession> {
  const result = await http<StaffAuthResponse>('GET', '/auth/me');
  if (!result) throw new Error('بيانات جلسة الموظف غير متاحة');
  return toAdminSession(result);
}

export async function demoReset(): Promise<void> {
  await http<void>('POST', '/admin/demo/reset');
}
