import { filterRequests } from './filters';

const items = [
  { kind: 'report' as const, status: 'in_progress' as const },
  { kind: 'service' as const, status: 'assigned' as const },
  { kind: 'report' as const, status: 'resolved' as const },
  { kind: 'service' as const, status: 'closed' as const },
];

describe('filterRequests', () => {
  it('all keeps everything', () => expect(filterRequests(items, 'all')).toHaveLength(4));
  it('reports / services split by kind', () => {
    expect(filterRequests(items, 'reports')).toHaveLength(2);
    expect(filterRequests(items, 'services')).toHaveLength(2);
  });
  it('open excludes resolved and closed', () => {
    expect(filterRequests(items, 'open').map((i) => i.status)).toEqual(['in_progress', 'assigned']);
  });
  it('fixed is resolved or closed', () => {
    expect(filterRequests(items, 'fixed').map((i) => i.status)).toEqual(['resolved', 'closed']);
  });
});
