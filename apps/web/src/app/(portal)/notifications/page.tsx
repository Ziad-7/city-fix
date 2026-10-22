'use client';

import { useRouter } from 'next/navigation';
import type { AppNotification } from '@/domain/types';
import { useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { useNotifications, useUnreadCount } from '@/store/useNotifications';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';
import { STATUS_COLOR } from '@/ui/StatusChip';
import { relativeTime } from '@/utils/time';

/** مركز الإشعارات: status changes on the citizen's reports and service requests, newest first. */
export default function NotificationsPage() {
  const tr = useTr();
  const router = useRouter();
  const items = useNotifications((s) => s.items);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = useUnreadCount();
  usePageTitle(tr('الإشعارات', 'Notifications'));

  const open = (n: AppNotification) => {
    markRead(n.id);
    router.push(`/requests/${n.entityId}`);
  };

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head">
        <div>
          <h1 className="w-h1">{tr('الإشعارات', 'Notifications')}</h1>
          <p className="w-sub">{tr('تغييرات حالة بلاغاتك وطلباتك، الأحدث الأول.', 'Status changes on your reports and requests, newest first.')}</p>
        </div>
        {unread > 0 ? (
          <button className="ftc-btn ftc-btn--secondary ftc-btn--sm" type="button" onClick={markAllRead} data-testid="mark-all-read">
            <Icon name="check" size={18} />{tr('علّم الكل مقروء', 'Mark all as read')}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <StateMessage
          icon="bell"
          title={tr('مفيش إشعارات لسه', 'No notifications yet')}
          body={tr('هنبلّغك هنا أول ما حالة بلاغ أو طلب من بتوعك تتغيّر.', "We'll tell you here when one of your reports or requests changes.")}
          actionLabel={tr('طلباتي', 'My requests')}
          actionHref="/requests"
        />
      ) : (
        <ul className="n-list" aria-label={tr('الإشعارات', 'Notifications')}>
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`w-rowcard n-row${n.read ? '' : ' is-unread'}`}
                data-testid={`notification-${n.entityId}`}
                onClick={() => open(n)}
              >
                <span className="n-dot" style={{ background: n.read ? 'var(--ftc-line)' : STATUS_COLOR[n.status] }} aria-hidden="true" />
                <span className="w-grow">
                  {n.read ? null : <span className="n-sr">{tr('جديد', 'New')}. </span>}
                  <span className="w-t" style={n.read ? undefined : { fontWeight: 700 }}>{n.title}</span>
                  <span className="w-m">{n.body}</span>
                  <span className="w-m">{relativeTime(n.at)}</span>
                </span>
                <Icon name="chevron" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
