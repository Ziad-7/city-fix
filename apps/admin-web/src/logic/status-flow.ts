/**
 * Status transition logic for incidents and work orders.
 */
import type { IncidentStatus } from '@/domain/types';

const INCIDENT_STATUS_FLOW: Record<IncidentStatus, IncidentStatus[]> = {
  received: ['triaged', 'assigned'],
  triaged: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

/**
 * Get the next valid statuses for an incident given its current status.
 */
export function getNextIncidentStatuses(currentStatus: IncidentStatus): IncidentStatus[] {
  return INCIDENT_STATUS_FLOW[currentStatus] || [];
}
