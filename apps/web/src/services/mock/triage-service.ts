import { triageMock } from '@/logic/triage-mock';
import { findDuplicates, splitByUser } from '@/logic/duplicates';
import type { TriageService } from '../interfaces';
import { delay, loadDb } from './db';

export function createMockTriageService(): TriageService {
  return {
    async analyze({ userId, description, categoryId, location }) {
      await delay(600);
      const suggestion = triageMock({ description, categoryId });
      if (!location) return suggestion;

      // Search every category the citizen might end up submitting (top-3 plus their own pick); the form
      // shows the matches of the effective category only.
      const categories = [...new Set([...suggestion.options.map((o) => o.categoryId), ...(categoryId ? [categoryId] : [])])];
      const db = await loadDb();
      const ownReportByIncident = new Map<string, string>();
      for (const r of db.reports) if (r.reporterId === userId) ownReportByIncident.set(r.incidentId, r.id);
      const following = new Set(db.following[userId] ?? []);
      const { duplicates, alreadyReported } = splitByUser(findDuplicates(db.incidents, categories, location), ownReportByIncident, following);
      return { ...suggestion, duplicates, alreadyReported };
    },
  };
}
