import { http } from '@/lib/http';
import type { WorkOrder, WorkOrderTask } from '@/domain/admin-types';

export async function getWorkOrders(params?: {
  status?: string;
  department?: string;
}): Promise<WorkOrder[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.department) searchParams.append('department', params.department);

  const qs = searchParams.toString();
  const result = await http<WorkOrder[]>('GET', `/admin/work-orders${qs ? '?' + qs : ''}`);
  return result || [];
}

export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const result = await http<WorkOrder>('GET', `/admin/work-orders/${id}`);
  if (!result) throw new Error('No work order returned');
  return result;
}

export async function createWorkOrder(data: {
  incidentId?: string;
  serviceRequestId?: string;
  department: string;
  team?: string;
  teamSize?: number;
  supervisor?: string;
  dueAt?: string;
  tasks?: string[];
}): Promise<WorkOrder> {
  const result = await http<WorkOrder>('POST', '/admin/work-orders', data);
  if (!result) throw new Error('No work order returned');
  return result;
}

export async function patchWorkOrder(
  id: string,
  data: {
    status?: string;
    team?: string;
    teamSize?: number;
    supervisor?: string;
    dueAt?: string;
    tasks?: WorkOrderTask[];
    note?: string;
  },
): Promise<WorkOrder> {
  const result = await http<WorkOrder>('PATCH', `/admin/work-orders/${id}`, data);
  if (!result) throw new Error('No work order returned');
  return result;
}
