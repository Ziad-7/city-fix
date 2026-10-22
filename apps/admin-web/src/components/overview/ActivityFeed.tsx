import Link from 'next/link';
import { Card, CardHead, EmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { AdminIconName } from '@/components/admin-icon-shapes';
import { formatTime } from '@/lib/format';
import type { IncidentStatus } from '@/domain/types';

interface ActivityFeedProps {
  activity: {
    actor: string;
    text: string;
    entityId?: string;
    status?: IncidentStatus;
    at: string;
  }[];
  loading: boolean;
}

export function ActivityFeed({ activity, loading }: ActivityFeedProps) {
  const displayActivity = activity.slice(0, 8);

  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-act"
          title="آخر الأنشطة"
          subtitle="النهارده"
        />
      </Card>
    );
  }

  if (activity.length === 0) {
    return (
      <Card>
        <CardHead
          id="h-act"
          title="آخر الأنشطة"
          subtitle="النهارده"
        />
        <EmptyState
          icon="clock"
          title="مفيش أنشطة النهارده"
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        id="h-act"
        title="آخر الأنشطة"
        subtitle="النهارده"
      />
      <ul className="feed">
        {displayActivity.map((item, idx) => {
          let icon: AdminIconName = 'wrench';
          let modifier = '';

          if (item.status === 'resolved') {
            icon = 'check';
            modifier = 'ic--ok';
          } else if (item.status === 'received') {
            icon = 'alert-triangle';
            modifier = 'ic--urgent';
          } else if (item.actor === 'الذكاء الاصطناعي' || item.text.startsWith('اقتراح')) {
            icon = 'sparkles';
            modifier = 'ic--ai';
          }

          // Extract entity ID from text
          const entityMatch = item.text.match(/([A-Z]+-\d+)/);
          const linkId = item.entityId || entityMatch?.[1];

          return (
            <li key={idx}>
              <span className={`ic ${modifier}`}>
                <Icon name={icon as any} size={16} />
              </span>
              <span>
                {item.actor === 'الذكاء الاصطناعي' ? (
                  <b>اقتراح الذكاء الاصطناعي:</b>
                ) : (
                  <b>{item.actor}</b>
                )}{' '}
                {item.text}
                {linkId && (
                  <>
                    {' '}
                    <Link
                      href={linkId.startsWith('WO-') ? `/work-orders?open=${linkId}` : `/incidents/${linkId}`}
                      className="ftc-link"
                    >
                      {linkId}
                    </Link>
                  </>
                )}
              </span>
              <time>{formatTime(item.at)}</time>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
