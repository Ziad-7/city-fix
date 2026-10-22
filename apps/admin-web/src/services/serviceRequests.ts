import { http } from '@/lib/http';
import type { AdminServiceRequest } from '@/domain/admin-types';

export async function getServiceRequests(params?: {
  status?: string;
  serviceType?: string;
  day?: string;
  payment?: string;
}): Promise<AdminServiceRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.serviceType) searchParams.append('serviceType', params.serviceType);
  if (params?.day) searchParams.append('day', params.day);
  if (params?.payment) searchParams.append('payment', params.payment);

  const qs = searchParams.toString();
  const result = await http<AdminServiceRequest[]>('GET', `/admin/service-requests${qs ? '?' + qs : ''}`);
  return result || [];
}

export async function getServiceRequest(id: string): Promise<AdminServiceRequest> {
  const result = await http<AdminServiceRequest>('GET', `/admin/service-requests/${id}`);
  if (!result) throw new Error('No service request returned');
  return result;
}

export async function patchServiceRequest(
  id: string,
  data: {
    status?: string;
    day?: string;
    slot?: string;
    assignee?: string;
    note?: string;
  },
): Promise<AdminServiceRequest> {
  const result = await http<AdminServiceRequest>('PATCH', `/admin/service-requests/${id}`, data);
  if (!result) throw new Error('No service request returned');
  return result;
}
