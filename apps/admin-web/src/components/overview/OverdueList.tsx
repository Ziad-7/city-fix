import Link from 'next/link';
import { Card, CardHead, Tag, ScoreBadge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { formatDueLabel, shortAddress, formatNumber } from '@/lib/format';

interface OverdueListProps {
  overdueList: {
    incidentId: string;
    title: string;
    department: string;
    address: string;
    priorityScore: number;
    dueAt: string;
    hoursLate: number;
    external: boolean;
    externalHotline?: string;
  }[];
  overdueTotal: number;
  loading: boolean;
}

export function OverdueList({ overdueList, overdueTotal, loading }: OverdueListProps) {
  const displayList = overdueList.slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-sla"
          icon="alert-triangle"
          title="فاتت ميعادها أو قربت"
          subtitle="المطلوب منك النهارده · مرتّبة حسب الأولوية"
        />
      </Card>
    );
  }

  if (overdueList.length === 0) {
    return (
      <Card>
        <CardHead
          id="h-sla"
          icon="alert-triangle"
          title="فاتت ميعادها أو قربت"
          subtitle="المطلوب منك النهارده · مرتّبة حسب الأولوية"
        />
        <EmptyState
          icon="check"
          title="مفيش حاجة متأخرة"
          message="كل البلاغات جوه الميعاد."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        id="h-sla"
        icon="alert-triangle"
        title="فاتت ميعادها أو قربت"
        subtitle="المطلوب منك النهارده · مرتّبة حسب الأولوية"
        action={<Tag tone="danger">{overdueTotal} متأخرة</Tag>}
      />

      <ul className="sla">
        {displayList.map((item) => (
          <li key={item.incidentId}>
            <ScoreBadge score={item.priorityScore} />
            <span className="t">
              <Link href={`/incidents/${item.incidentId}`}>
                {item.incidentId} · {item.title}
              </Link>
              <span className="mini">
                {item.department}
                {item.external && item.externalHotline && ` · جهة خارجية · ${item.externalHotline}`}
                {!item.external && ` · ${shortAddress(item.address)}`}
              </span>
            </span>
            <Tag tone="danger">{formatDueLabel(item.hoursLate)}</Tag>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Link
          href={`/incidents?view=overdue`}
          className="ftc-link"
        >
          شوف كل المتأخرة ({formatNumber(overdueTotal)})
          <Icon name="chevron-left" size={16} />
        </Link>
      </div>
    </Card>
  );
}
