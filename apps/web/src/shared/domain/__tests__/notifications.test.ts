import { describeChange, diffStatuses, type TrackedItem } from '../notifications';

const report = (over: Partial<TrackedItem> = {}): TrackedItem => ({
  entityType: 'report',
  entityId: 'FTC-1042',
  status: 'received',
  department: 'صيانة الطرق',
  ...over,
});

const ids = (it: TrackedItem, i: number) => `n-${it.entityId}-${i}`;
const AT = '2026-10-21T10:00:00.000Z';

describe('diffStatuses', () => {
  it('records the baseline on first load without creating notifications', () => {
    const { known, created } = diffStatuses({}, [report({ status: 'assigned' })], AT, ids);
    expect(created).toEqual([]);
    expect(known).toEqual({ 'FTC-1042': 'assigned' });
  });

  it('creates a notification when a status changes', () => {
    const { known, created } = diffStatuses({ 'FTC-1042': 'triaged' }, [report({ status: 'assigned', note: 'اتحوّل لصيانة الطرق' })], AT, ids);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ entityType: 'report', entityId: 'FTC-1042', status: 'assigned', read: false, at: AT });
    expect(created[0].title).toBe('بلاغك FTC-1042 اتحوّل لصيانة الطرق');
    expect(created[0].body).toBe('اتحوّل لصيانة الطرق');
    expect(known['FTC-1042']).toBe('assigned');
  });

  it('stays quiet when nothing changed, and keeps entities that are not in the list', () => {
    const { known, created } = diffStatuses({ 'FTC-1042': 'assigned', 'SRV-1': 'received' }, [report({ status: 'assigned' })], AT, ids);
    expect(created).toEqual([]);
    expect(known).toEqual({ 'FTC-1042': 'assigned', 'SRV-1': 'received' });
  });

  it('handles several changes and a new item in one batch', () => {
    const items: TrackedItem[] = [
      report({ status: 'resolved' }),
      { entityType: 'service_request', entityId: 'SRV-2001', status: 'in_progress', note: 'العربية في الطريق' },
      report({ entityId: 'FTC-1099', status: 'received' }),
    ];
    const { created, known } = diffStatuses({ 'FTC-1042': 'in_progress', 'SRV-2001': 'assigned' }, items, AT, ids);
    expect(created.map((n) => n.entityId)).toEqual(['FTC-1042', 'SRV-2001']);
    expect(known['FTC-1099']).toBe('received');
  });
});

describe('describeChange', () => {
  it('says thanks when a report is fixed', () => {
    const d = describeChange(report({ status: 'resolved' }), 'in_progress');
    expect(d.title).toBe('بلاغك FTC-1042 اتصلّح');
    expect(d.body).toBe('اتصلّحت! شكرًا على بلاغك');
  });

  it('says a reopened report was reopened', () => {
    expect(describeChange(report({ status: 'received', note: 'اتفتح تاني: لسه موجودة' }), 'resolved')).toEqual({
      title: 'بلاغك FTC-1042 اتفتح تاني',
      body: 'اتفتح تاني: لسه موجودة',
    });
  });

  it('uses "طلبك" for service requests', () => {
    const d = describeChange({ entityType: 'service_request', entityId: 'SRV-7', status: 'assigned' }, 'received');
    expect(d.title).toBe('طلبك SRV-7 اتحوّل للفريق المسؤول');
  });
});
