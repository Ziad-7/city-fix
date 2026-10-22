import { KpiCard, Delta } from '@/components/ui/KpiCard';
import { formatNumber, formatDays, formatPercent } from '@/lib/format';
import type { DashboardStats } from '@/domain/admin-types';

interface OverviewKpisProps {
  dashboard: DashboardStats | undefined;
  range: 'today' | '7d' | '30d';
  loading: boolean;
}

const PERIOD_LABELS: Record<'today' | '7d' | '30d', string> = {
  today: 'امبارح',
  '7d': 'الأسبوع اللي فات',
  '30d': 'الشهر اللي فات',
};

const RESOLVED_LABELS: Record<'today' | '7d' | '30d', string> = {
  today: 'اتحلّت النهارده',
  '7d': 'اتحلّت الأسبوع ده',
  '30d': 'اتحلّت الشهر ده',
};

export function OverviewKpis({ dashboard, range, loading }: OverviewKpisProps) {
  const period = PERIOD_LABELS[range];
  const resolvedLabel = RESOLVED_LABELS[range];

  if (loading || !dashboard) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <KpiCard label="بلاغات مفتوحة" value="..." loading />
        <KpiCard label="متأخرة عن الميعاد" value="..." loading />
        <KpiCard label={resolvedLabel} value="..." loading />
        <KpiCard label="متوسط وقت الحل" value="..." loading />
      </div>
    );
  }

  // First KPI: Open incidents
  const openDeltaTone = dashboard.openDelta > 0 ? 'bad' : dashboard.openDelta < 0 ? 'good' : 'mute';
  const openNote = dashboard.openDelta === 0 ? `زي ${period}` : undefined;

  // Third KPI: Resolved this week
  const resolvedDeltaTone = dashboard.resolvedDelta > 0 ? 'good' : dashboard.resolvedDelta < 0 ? 'bad' : 'mute';
  const resolvedNote = dashboard.resolvedDelta === 0 ? `زي ${period}` : undefined;

  // Fourth KPI: Average resolution days
  const absDelta = Math.abs(dashboard.avgResolutionDeltaDays);
  let resolutionNote = '';
  let resolutionTone: 'good' | 'bad' | 'mute' = 'mute';
  if (dashboard.avgResolutionDeltaDays < 0) {
    resolutionNote = `أسرع بـ ${formatNumber(absDelta)} يوم`;
    resolutionTone = 'good';
  } else if (dashboard.avgResolutionDeltaDays > 0) {
    resolutionNote = `أبطأ بـ ${formatNumber(absDelta)} يوم`;
    resolutionTone = 'bad';
  } else {
    resolutionNote = `زي ${period}`;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
      <KpiCard
        label="بلاغات مفتوحة"
        value={formatNumber(dashboard.open)}
        note={
          dashboard.openDelta === 0 ? (
            openNote
          ) : (
            <>
              <Delta value={dashboard.openDelta} /> عن {period}
            </>
          )
        }
        noteTone={openDeltaTone}
      />

      <KpiCard
        label="متأخرة عن الميعاد"
        value={formatNumber(dashboard.overdue)}
        valueTone="urgent"
        note={`من الـ ${formatNumber(dashboard.open)} · ${formatPercent(dashboard.overdue, dashboard.open)}`}
        noteTone="mute"
      />

      <KpiCard
        label={resolvedLabel}
        value={formatNumber(dashboard.resolvedThisWeek)}
        note={
          dashboard.resolvedDelta === 0 ? (
            resolvedNote
          ) : (
            <>
              <Delta value={dashboard.resolvedDelta} /> عن {period}
            </>
          )
        }
        noteTone={resolvedDeltaTone}
      />

      <KpiCard
        label="متوسط وقت الحل"
        value={formatDays(dashboard.avgResolutionDays)}
        note={resolutionNote}
        noteTone={resolutionTone}
      />
    </div>
  );
}
