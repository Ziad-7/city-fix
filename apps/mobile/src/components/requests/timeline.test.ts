import type { TimelineEntry } from '@/domain/types';
import { buildTimelineSteps } from './timeline';

const e = (status: TimelineEntry['status'], at: string, note: string = status): TimelineEntry => ({ status, at, note, actor: 'النظام' });

describe('buildTimelineSteps', () => {
  it('marks the last open entry as current and appends future stages', () => {
    const steps = buildTimelineSteps(
      [e('received', '2026-10-21T08:00:00Z'), e('triaged', '2026-10-21T08:30:00Z'), e('assigned', '2026-10-21T09:00:00Z')],
      'report',
      'assigned',
    );
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'future', 'future']);
    expect(steps[3].title).toBe('الفريق في الموقع');
    expect(steps[4].title).toBe('اتصلّحت');
  });

  it('shows everything as done once resolved, with no future stages', () => {
    const steps = buildTimelineSteps([e('received', '2026-10-21T08:00:00Z'), e('resolved', '2026-10-22T08:00:00Z')], 'report', 'resolved');
    expect(steps.map((s) => s.state)).toEqual(['done', 'done']);
  });

  it('sorts unordered entries by time', () => {
    const steps = buildTimelineSteps([e('assigned', '2026-10-21T09:00:00Z', 'b'), e('received', '2026-10-21T08:00:00Z', 'a')], 'service', 'assigned');
    expect(steps.slice(0, 2).map((s) => s.title)).toEqual(['a', 'b']);
    expect(steps[1].state).toBe('current');
  });

  it('uses service wording for future stages', () => {
    const steps = buildTimelineSteps([e('received', '2026-10-21T08:00:00Z')], 'service', 'received');
    expect(steps[steps.length - 1].title).toBe('اتنفّذ الطلب');
  });
});
