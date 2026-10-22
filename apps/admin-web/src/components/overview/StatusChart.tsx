import { Card, CardHead, StackBar, LegendRows } from '@/components/ui';
import { StackSegment } from '@/components/ui/Charts';
import type { IncidentStatus } from '@/domain/types';

interface StatusChartProps {
  data: { status: IncidentStatus; count: number }[];
  open: number;
  resolved: number;
  range: 'today' | '7d' | '30d';
  loading: boolean;
}

const RANGE_LABEL: Record<'today' | '7d' | '30d', string> = {
  today: 'النهارده',
  '7d': 'الأسبوع ده',
  '30d': 'الشهر ده',
};

export function StatusChart({ data, open, resolved, range, loading }: StatusChartProps) {
  const rangeLabel = RANGE_LABEL[range];

  if (loading) {
    return (
      <Card>
        <CardHead
          id="h-st"
          title="حالة البلاغات"
          subtitle={`المفتوحة دلوقتي: ${open}`}
        />
      </Card>
    );
  }

  // Find received + triaged
  const received = data.find(d => d.status === 'received')?.count || 0;
  const triaged = data.find(d => d.status === 'triaged')?.count || 0;
  const assigned = data.find(d => d.status === 'assigned')?.count || 0;
  const inProgress = data.find(d => d.status === 'in_progress')?.count || 0;

  const segments: StackSegment[] = [
    { key: 'received', value: received + triaged },
    { key: 'assigned', value: assigned },
    { key: 'progress', value: inProgress },
  ];

  return (
    <Card>
      <CardHead
        id="h-st"
        title="حالة البلاغات"
        subtitle={`المفتوحة دلوقتي: ${open}`}
      />

      <StackBar
        segments={segments}
        ariaLabel={`وصل ${received + triaged}، اتحوّل ${assigned}، جاري التنفيذ ${inProgress}`}
      />

      <LegendRows segments={segments} />

      <hr className="ftc-divider" />

      <div className="row-between">
        <div>
          <span className="ftc-status-chip-resolved">اتصلّح</span>
          <span className="mini">{rangeLabel}</span>
        </div>
        <span className="strong num">{resolved}</span>
      </div>

      <p className="sec-sub" style={{ marginTop: '12px' }}>
        كل حالة بتتقرأ بالكلمة واللون. الأرقام للبلاغات اللي لسه شغالين عليها.
      </p>
    </Card>
  );
}
