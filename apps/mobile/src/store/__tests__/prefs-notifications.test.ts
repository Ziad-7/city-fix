import { LARGE_TEXT_SCALE, scaleTextStyle, textScaleFor, usePrefs } from '../usePrefs';
import { useNotifications } from '../useNotifications';

jest.mock('@/notifications/os', () => ({
  showLocalNotification: jest.fn(() => Promise.resolve()),
  setupOsNotifications: jest.fn(),
  ensureNotificationPermission: jest.fn(),
  onNotificationTapped: jest.fn(),
}));

describe('large text helper', () => {
  it('scales font size and line height by 1.15', () => {
    expect(textScaleFor(false)).toBe(1);
    expect(textScaleFor(true)).toBe(LARGE_TEXT_SCALE);
    expect(scaleTextStyle({ fontSize: 16, lineHeight: 28, color: 'x' } as { fontSize: number; lineHeight: number }, 1.15)).toEqual({
      fontSize: 18,
      lineHeight: 32,
      color: 'x',
    });
  });

  it('leaves styles untouched at scale 1 and when sizes are missing', () => {
    const s = { fontSize: 14 };
    expect(scaleTextStyle(s, 1)).toBe(s);
    expect(scaleTextStyle({}, 1.15)).toEqual({});
  });

  it('defaults: normal text, app notifications on', () => {
    expect(usePrefs.getState().largeText).toBe(false);
    expect(usePrefs.getState().appNotifications).toBe(true);
    usePrefs.getState().setLargeText(true);
    expect(usePrefs.getState().largeText).toBe(true);
    usePrefs.getState().setLargeText(false);
  });
});

describe('useNotifications.sync', () => {
  beforeEach(() => useNotifications.getState().reset());

  const item = (status: 'received' | 'assigned' | 'resolved') => ({ entityType: 'report' as const, entityId: 'FTC-1', status, department: 'الإنارة' });

  it('ignores the first load, notifies on change, and tracks unread', () => {
    const { sync, markRead, markAllRead } = useNotifications.getState();
    expect(sync([item('received')])).toEqual([]);
    expect(useNotifications.getState().items).toHaveLength(0);

    expect(sync([item('assigned')])).toHaveLength(1);
    expect(sync([item('assigned')])).toHaveLength(0);
    expect(sync([item('resolved')])).toHaveLength(1);

    const items = useNotifications.getState().items;
    expect(items.map((n) => n.status)).toEqual(['resolved', 'assigned']);
    expect(items.every((n) => !n.read)).toBe(true);

    markRead(items[0].id);
    expect(useNotifications.getState().items.filter((n) => !n.read)).toHaveLength(1);
    markAllRead();
    expect(useNotifications.getState().items.every((n) => n.read)).toBe(true);
  });
});
