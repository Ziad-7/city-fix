import { describe, it, expect } from 'vitest';
import { getNextIncidentStatuses } from '../status-flow';

describe('status-flow', () => {
  it('returns correct next statuses for received', () => {
    const statuses = getNextIncidentStatuses('received');
    expect(statuses).toEqual(['triaged', 'assigned']);
  });

  it('returns correct next statuses for triaged', () => {
    const statuses = getNextIncidentStatuses('triaged');
    expect(statuses).toEqual(['assigned']);
  });

  it('returns correct next statuses for assigned', () => {
    const statuses = getNextIncidentStatuses('assigned');
    expect(statuses).toEqual(['in_progress']);
  });

  it('returns correct next statuses for in_progress', () => {
    const statuses = getNextIncidentStatuses('in_progress');
    expect(statuses).toEqual(['resolved']);
  });

  it('returns correct next statuses for resolved', () => {
    const statuses = getNextIncidentStatuses('resolved');
    expect(statuses).toEqual(['closed']);
  });

  it('returns empty array for closed', () => {
    const statuses = getNextIncidentStatuses('closed');
    expect(statuses).toEqual([]);
  });
});
