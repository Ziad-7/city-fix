import type { TimelineEntry } from '@/domain/types';
import { usePrefs } from '@/store/usePrefs';
import { dayText, followersLine, paymentLabel, slotLabel } from './labels';
import { buildTimelineSteps } from './timeline';

describe('requests in English', () => {
  beforeEach(() => usePrefs.setState({ lang: 'en' }));
  afterEach(() => usePrefs.setState({ lang: 'ar' }));

  it('words followers, slots and payment', () => {
    expect(followersLine(0)).toBe('No one is following this report yet');
    expect(followersLine(1)).toBe('1 person is following this report');
    expect(followersLine(12)).toBe('12 people are following this report');
    expect(slotLabel('morning')).toBe('9 AM – 12 PM');
    expect(paymentLabel('instapay')).toBe('InstaPay');
    expect(paymentLabel(undefined)).toBe('Free');
  });

  it('writes the day with the English weekday and month', () => {
    expect(dayText('2026-10-25')).toBe('Sunday 25 Oct');
  });

  it('has English future steps', () => {
    const e: TimelineEntry = { status: 'received', at: '2026-10-21T08:00:00Z', note: 'We got your report', actor: 'System' };
    const steps = buildTimelineSteps([e], 'report', 'received');
    expect(steps.map((s) => s.title)).toEqual(['We got your report', 'Reviewed', 'Sent to the responsible team', 'The team is on site', 'Fixed']);
  });
});
