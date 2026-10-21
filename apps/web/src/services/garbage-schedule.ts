import { DEFAULT_GARBAGE_SCHEDULE, findGarbageSchedule, type GarbageSchedule } from '@/domain/garbage-schedule';
import { http } from './api/http';
import { API_MODE } from './index';

/**
 * GET /services/garbage-schedule?district=… (proposed). Mock mode (default) reads the static demo data.
 * In API mode a missing endpoint or a network error falls back to the static data, so the screen still works.
 */
export async function getGarbageSchedule(district: string): Promise<GarbageSchedule> {
  if (API_MODE === 'api') {
    try {
      const res = await http<GarbageSchedule>('GET', `/services/garbage-schedule?district=${encodeURIComponent(district)}`);
      if (res && Array.isArray(res.days)) return res;
    } catch {
      // fall through to the demo data
    }
  }
  return findGarbageSchedule(district) ?? { district, ...DEFAULT_GARBAGE_SCHEDULE };
}
