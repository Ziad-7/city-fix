import { describe, expect, it } from 'vitest';
import { normalizeAdminIncident } from '../incidents';
import type { AdminIncident } from '@/domain/admin-types';

describe('normalizeAdminIncident', () => {
  it('turns the backend triage confidence map into ranked options', () => {
    const incident = {
      id: 'incident-1',
      triage: {
        categoryId: 'pothole',
        severity: 'high',
        confidence: 0.7,
        confidences: { garbage: 0.2, pothole: 0.7, streetlight_out: 0.1 },
        source: 'model',
        confirmed: false,
      },
    } as unknown as AdminIncident;

    expect(normalizeAdminIncident(incident).triage?.options).toEqual([
      { categoryId: 'pothole', confidence: 0.7 },
      { categoryId: 'garbage', confidence: 0.2 },
      { categoryId: 'streetlight_out', confidence: 0.1 },
    ]);
  });
});
