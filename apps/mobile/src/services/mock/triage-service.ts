import { triageMock } from '@/logic/triage-mock';
import type { IncidentService, TriageService } from '../interfaces';
import { delay } from './db';

export function createMockTriageService(incidents: IncidentService): TriageService {
  return {
    async analyze({ description, categoryId, location }) {
      await delay(600);
      const suggestion = triageMock({ description, categoryId });
      const duplicates = location
        ? await incidents.findDuplicates(suggestion.options[0].categoryId, location)
        : [];
      return { ...suggestion, duplicates };
    },
  };
}
