import { DEFAULT_GARBAGE_SCHEDULE, findGarbageSchedule } from '@/domain/garbage-schedule';
import { getGarbageSchedule } from '../garbage-schedule';

describe('getGarbageSchedule (mock mode)', () => {
  it('returns the published schedule of the district', async () => {
    expect(await getGarbageSchedule('مدينة نصر أول')).toEqual(findGarbageSchedule('مدينة نصر أول'));
  });

  it('falls back to the default schedule for a district without one', async () => {
    expect(await getGarbageSchedule('حي جديد')).toEqual({ district: 'حي جديد', ...DEFAULT_GARBAGE_SCHEDULE });
  });
});
