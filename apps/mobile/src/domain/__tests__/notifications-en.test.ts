import { usePrefs } from '@/store/usePrefs';
import { describeChange, diffStatuses, type TrackedItem } from '../notifications';

const report = (over: Partial<TrackedItem> = {}): TrackedItem => ({ entityType: 'report', entityId: 'FTC-1042', status: 'received', department: 'صيانة الطرق', ...over });

describe('notifications in English', () => {
  beforeEach(() => usePrefs.setState({ lang: 'en' }));
  afterEach(() => usePrefs.setState({ lang: 'ar' }));

  it('words each status for a report', () => {
    expect(describeChange(report({ status: 'received' }), 'received')).toEqual({ title: 'We got your report FTC-1042', body: "We'll start reviewing it" });
    expect(describeChange(report({ status: 'received' }), 'resolved').title).toBe('Your report FTC-1042 was reopened');
    expect(describeChange(report({ status: 'assigned' }), 'triaged')).toEqual({
      title: 'Your report FTC-1042 was sent to Road Maintenance',
      body: "We'll let you know when the team arrives",
    });
    expect(describeChange(report({ status: 'in_progress' }), 'assigned').title).toBe('The team started work on your report FTC-1042');
    expect(describeChange(report({ status: 'resolved' }), 'in_progress')).toEqual({ title: 'Your report FTC-1042 is fixed', body: "It's fixed! Thank you for your report" });
  });

  it('words service requests and uses the timeline note when there is one', () => {
    const svc: TrackedItem = { entityType: 'service_request', entityId: 'SRV-2001', status: 'in_progress', note: 'The truck is on the way' };
    expect(describeChange(svc, 'assigned')).toEqual({ title: 'Your request SRV-2001 is being carried out', body: 'The truck is on the way' });
    expect(describeChange({ ...svc, status: 'resolved', note: undefined }, 'in_progress').title).toBe('Your request SRV-2001 was completed');
  });

  it('creates the notification text in the language of the moment', () => {
    const { created } = diffStatuses({ 'FTC-1042': 'triaged' }, [report({ status: 'assigned' })], '2026-10-21T10:00:00.000Z', (it, i) => `n-${it.entityId}-${i}`);
    expect(created[0].title).toBe('Your report FTC-1042 was sent to Road Maintenance');
    usePrefs.setState({ lang: 'ar' });
    expect(describeChange(report({ status: 'assigned' }), 'triaged').title).toBe('بلاغك FTC-1042 اتحوّل لصيانة الطرق');
  });
});
