'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, ErrorState, KpiCard, PageHead, Skeleton } from '@/components/ui';
import type { SmartBin, SmartBinStatus } from '@/domain/admin-types';
import { getSmartBinReadings, getSmartBins } from '@/services/bins';

const STATUS_LABEL: Record<SmartBinStatus, string> = {
  offline: 'غير متصل',
  full: 'ممتلئة',
  heat: 'حرارة مرتفعة',
  low_battery: 'بطارية منخفضة',
  normal: 'طبيعي',
};

const STATUS_COLOR: Record<SmartBinStatus, string> = {
  offline: '#77736c',
  full: '#b42335',
  heat: '#b45309',
  low_battery: '#8c6a00',
  normal: '#25734a',
};

function timeLabel(value?: string): string {
  if (!value) return 'لم تصل قراءة بعد';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ReadingChart({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <p className="mini muted">سجّل قراءتين على الأقل لعرض تاريخ الامتلاء.</p>;
  }
  const width = 640;
  const height = 170;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, value)) / 100) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="ftc-card" style={{ padding: 16, marginTop: 12 }}>
      <b>تاريخ مستوى الامتلاء</b>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="رسم تاريخ امتلاء الحاوية" style={{ width: '100%', display: 'block', marginTop: 10 }}>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - (tick / 100) * (height - 12) - 6;
          return <g key={tick}><line x1="0" x2={width} y1={y} y2={y} stroke="#e8e4de" strokeDasharray="4 4" /><text x="4" y={y - 3} fill="#777" fontSize="10">{tick}%</text></g>;
        })}
        <polyline points={points} fill="none" stroke="#c8102e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between' }} className="mini muted">
        <span>{values.length} قراءة محفوظة</span><span>الأقدم ← الأحدث</span>
      </div>
    </div>
  );
}

function BinCard({ bin, selected, onSelect }: { bin: SmartBin; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className="ftc-card"
      onClick={onSelect}
      aria-pressed={selected}
      style={{ textAlign: 'right', width: '100%', cursor: 'pointer', border: selected ? '2px solid #c8102e' : undefined }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div><b>{bin.name}</b><div className="mini muted" dir="ltr">{bin.id} · {bin.district}</div></div>
        <span style={{ color: STATUS_COLOR[bin.status], fontWeight: 700, fontSize: 12 }}>{STATUS_LABEL[bin.status]}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
        <div><small className="mini muted">الامتلاء</small><b style={{ display: 'block' }}>{bin.fillPct == null ? '—' : `${bin.fillPct}%`}</b></div>
        <div><small className="mini muted">الحرارة</small><b style={{ display: 'block' }}>{bin.tempC == null ? '—' : `${bin.tempC} °م`}</b></div>
        <div><small className="mini muted">البطارية</small><b style={{ display: 'block' }}>{bin.batteryV == null ? '—' : `${bin.batteryV} V`}</b></div>
      </div>
      <div style={{ height: 7, borderRadius: 8, background: '#eeeae3', marginTop: 12, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${bin.fillPct ?? 0}%`, background: bin.isFull ? '#c8102e' : '#d4a20b' }} />
      </div>
      <div className="mini muted" style={{ marginTop: 10 }}>آخر اتصال: {timeLabel(bin.lastSeenAt)} {bin.isSimulated ? '· بيانات محاكاة' : ''}</div>
    </button>
  );
}

export default function SmartBinsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: bins = [], isLoading, error, refetch } = useQuery({
    queryKey: ['smart-bins'],
    queryFn: getSmartBins,
    refetchInterval: 30_000,
  });
  const selected = bins.find((bin) => bin.id === selectedId) ?? bins[0];
  const readings = useQuery({
    queryKey: ['smart-bin-readings', selected?.id],
    queryFn: () => getSmartBinReadings(selected!.id),
    enabled: !!selected,
    refetchInterval: 30_000,
  });
  const counts = useMemo(() => ({
    total: bins.length,
    alerts: bins.filter((bin) => ['full', 'heat', 'low_battery'].includes(bin.status)).length,
    offline: bins.filter((bin) => bin.status === 'offline').length,
  }), [bins]);
  const fillHistory = [...(readings.data ?? [])].reverse().map((reading) => reading.fillPct);

  return (
    <main>
      <PageHead
        title="الحاويات الذكية"
        subtitle="قراءات الحاويات والامتلاء والحرارة والبطارية تصل من واجهة الأجهزة."
        actions={<Button onClick={() => void refetch()}>تحديث</Button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiCard label="إجمالي الحاويات" value={counts.total} />
        <KpiCard label="تنبيهات تحتاج متابعة" value={counts.alerts} />
        <KpiCard label="غير متصلة" value={counts.offline} />
      </div>
      {isLoading ? <Skeleton variant="block" height={180} /> : error ? <ErrorState message="تعذر تحميل بيانات الحاويات." /> : bins.length === 0 ? (
        <EmptyState title="لا توجد حاويات مسجلة" message="سجّل جهازاً من واجهة API الإدارية لبدء استقبال القراءات." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {bins.map((bin) => <BinCard key={bin.id} bin={bin} selected={selected?.id === bin.id} onSelect={() => setSelectedId(bin.id)} />)}
        </div>
      )}
      {selected && (
        <section style={{ marginTop: 20 }} aria-label={`تفاصيل ${selected.name}`}>
          <h2 style={{ fontSize: 20 }}>{selected.name} · سجل القراءات</h2>
          {readings.isLoading ? <Skeleton variant="block" height={180} /> : readings.error ? <ErrorState message="تعذر تحميل سجل القراءات." /> : (
            <>
              <ReadingChart values={fillHistory} />
              <div className="ftc-card" style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead><tr><th>التسلسل</th><th>الامتلاء</th><th>المسافة</th><th>الحرارة</th><th>البطارية</th><th>الإشارة</th><th>التنبيهات</th><th>وقت القراءة</th></tr></thead>
                  <tbody>{(readings.data ?? []).map((reading) => <tr key={reading.id}>
                    <td dir="ltr">#{reading.seq}</td><td>{reading.fillPct}%</td><td>{reading.distanceCm == null ? '—' : `${reading.distanceCm} سم`}</td><td>{reading.tempC} °م</td><td>{reading.batteryV} V</td><td>{reading.rssi == null ? '—' : `${reading.rssi} dBm`}</td>
                    <td>{reading.isFull ? 'ممتلئة ' : ''}{reading.isHot ? 'حرارة مرتفعة' : !reading.isFull ? '—' : ''}</td>
                    <td>{timeLabel(reading.recordedAt)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
