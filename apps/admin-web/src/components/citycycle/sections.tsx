'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, ErrorState, KpiCard, Skeleton, TextField, useToast } from '@/components/ui';
import type { CollectorStatus, MaterialId, PickupStatus } from '@/domain/citycycle-types';
import {
  getCollectors,
  getMaterialPrices,
  getPayouts,
  getPickups,
  getRecyclingSummary,
  patchCollector,
  cancelPickup,
  putMaterialPrices,
} from '@/services/citycycle';
import { getSmartBins } from '@/services/bins';
import { COLLECTOR_STATUS_LABEL_AR, MATERIAL_LABEL_AR, PICKUP_STATUS_LABEL_AR } from '@/lib/text';
import { formatDecimal, formatEgp, formatNumber } from '@/lib/format';

const mat = (id: string) => MATERIAL_LABEL_AR[id] ?? id;

function Loading() {
  return <Skeleton variant="block" height={160} />;
}

export function PickupsSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<PickupStatus | ''>('');
  const q = useQuery({ queryKey: ['cc-pickups', filter], queryFn: () => getPickups(filter || undefined) });
  const m = useMutation({
    mutationFn: (id: string) => cancelPickup(id, 'اتلغى من مركز القيادة'),
    onSuccess: () => {
      toast.success('اتلغى الطلب');
      void qc.invalidateQueries({ queryKey: ['cc-pickups'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message="مقدرناش نحمّل طلبات التدوير." />;
  const rows = q.data ?? [];
  return (
    <section aria-label="طلبات التدوير">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['', 'requested', 'accepted', 'weighed', 'completed', 'cancelled'] as const).map((s) => (
          <Button key={s || 'all'} size="sm" variant={filter === s ? 'primary' : 'secondary'} onClick={() => setFilter(s)}>
            {s ? PICKUP_STATUS_LABEL_AR[s] : 'الكل'}
          </Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="list" title="مفيش طلبات تدوير" message="الطلبات الجديدة هتظهر هنا." />
      ) : (
        <div className="ftc-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr><th>الطلب</th><th>المواد</th><th>العنوان</th><th>اليوم</th><th>الجامع</th><th>الحالة</th><th>إجراء</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                return (
                  <tr key={p.id}>
                    <td dir="ltr">{p.id}</td>
                    <td>{p.items.map((i) => `${mat(i.materialId)} ${formatNumber(i.estimatedKg)} كجم`).join('، ')}</td>
                    <td>{p.location?.address || '—'}</td>
                    <td dir="ltr">{p.day}</td>
                    <td>{p.collectorName ?? '—'}</td>
                    <td>{PICKUP_STATUS_LABEL_AR[p.status]}</td>
                    <td>
                      {isAdmin && (p.status === 'requested' || p.status === 'accepted') && (
                        <Button size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate(p.id)}>إلغاء</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function CollectorsSection({ isAdmin = false }: { isAdmin?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['cc-collectors'], queryFn: () => getCollectors() });
  const m = useMutation({
    mutationFn: (v: { id: string; status: CollectorStatus }) => patchCollector(v.id, { status: v.status, note: v.status === 'suspended' ? 'إيقاف من مركز القيادة' : undefined }),
    onSuccess: () => {
      toast.success('اتحدّثت حالة الجامع');
      void qc.invalidateQueries({ queryKey: ['cc-collectors'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message="مقدرناش نحمّل الجامعين." />;
  const rows = q.data ?? [];
  if (rows.length === 0) return <EmptyState icon="users" title="مفيش جامعين" message="طلبات الانضمام هتظهر هنا للمراجعة." />;
  return (
    <section aria-label="الجامعون" className="ftc-card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead><tr><th>الاسم</th><th>الحي</th><th>المواد</th><th>المركبة</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.district}</td>
              <td>{c.materials.map(mat).join('، ')}</td>
              <td>{c.vehicle ?? '—'}</td>
              <td>{COLLECTOR_STATUS_LABEL_AR[c.status]}</td>
              <td style={{ display: 'flex', gap: 6 }}>
                {isAdmin && c.status !== 'verified' && <Button size="sm" disabled={m.isPending} onClick={() => m.mutate({ id: c.id, status: 'verified' })}>توثيق</Button>}
                {isAdmin && c.status !== 'suspended' && <Button size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate({ id: c.id, status: 'suspended' })}>إيقاف</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PricesSection({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['cc-prices'], queryFn: () => getMaterialPrices() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: async () => {
      const rows = q.data ?? [];
      const district = rows[0]?.district ?? '';
      if (rows.length === 0 || !district) throw new Error('قائمة الأسعار فاضية');
      const prices = rows
        .filter((r) => draft[r.materialId] !== undefined && draft[r.materialId].trim() !== '')
        .map((r) => ({ materialId: r.materialId as MaterialId, priceEgpPerKg: Number(draft[r.materialId]) }));
      if (prices.some((p) => !Number.isFinite(p.priceEgpPerKg) || p.priceEgpPerKg < 0)) throw new Error('اكتب سعر صحيح');
      await putMaterialPrices(district, prices);
    },
    onSuccess: () => {
      toast.success('اتحفظت الأسعار');
      setDraft({});
      void qc.invalidateQueries({ queryKey: ['cc-prices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message="مقدرناش نحمّل قائمة الأسعار." />;
  const rows = q.data ?? [];
  return (
    <section aria-label="قائمة الأسعار" className="ftc-card" style={{ padding: 16 }}>
      <p className="mini muted">الأسعار بالجنيه للكيلو، والحي هو اللي بيحددها. {isAdmin ? '' : 'التعديل للمدير فقط.'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 8 }}>
        {rows.map((r) => (
          <TextField
            key={r.materialId}
            id={`price-${r.materialId}`}
            label={mat(r.materialId)}
            dir="ltr"
            value={draft[r.materialId] ?? (r.priceEgpPerKg == null ? '' : String(r.priceEgpPerKg))}
            placeholder="السعر هيتحدد"
            readOnly={!isAdmin}
            onChange={(v) => setDraft((d) => ({ ...d, [r.materialId]: v }))}
          />
        ))}
      </div>
      {isAdmin && (
        <div style={{ marginTop: 12 }}>
          <Button loading={m.isPending} disabled={Object.keys(draft).length === 0 || rows.length === 0 || !rows[0]?.district} onClick={() => m.mutate()}>حفظ الأسعار</Button>
        </div>
      )}
    </section>
  );
}

const BIN_ALERT: Record<string, string> = { full: 'ممتلئة', heat: 'حرارة مرتفعة', low_battery: 'بطارية منخفضة', offline: 'غير متصلة' };

export function BinAlertsSection() {
  const q = useQuery({ queryKey: ['smart-bins'], queryFn: getSmartBins, refetchInterval: 30_000 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message="مقدرناش نحمّل الحاويات." />;
  const alerts = (q.data ?? []).filter((b) => b.status !== 'normal');
  return (
    <section aria-label="تنبيهات الحاويات">
      <p className="mini muted">البلاغات عن حاوية ممتلئة من المواطنين بتظهر كبلاغات نظافة في <Link href="/incidents">البلاغات</Link>.</p>
      {alerts.length === 0 ? (
        <EmptyState icon="trash" title="مفيش تنبيهات" message="كل الحاويات شغالة طبيعي." />
      ) : (
        <ul className="ftc-card" style={{ listStyle: 'none', padding: 16, margin: '8px 0 0' }}>
          {alerts.map((b) => (
            <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span><b>{b.name}</b> <span className="mini muted" dir="ltr">{b.id}</span></span>
              <span>{BIN_ALERT[b.status]}{b.fillPct != null ? ` · ${formatNumber(b.fillPct)}%` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 12 }}><Link href="/bins">فتح صفحة الحاويات الذكية</Link></p>
    </section>
  );
}

export function ImpactSection() {
  const q = useQuery({ queryKey: ['cc-summary'], queryFn: getRecyclingSummary });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message="مقدرناش نحمّل إحصائيات الأثر." />;
  const s = q.data;
  return (
    <section aria-label="الأثر">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiCard label="طن اتحوّل عن الدفن" value={formatNumber(Math.round(s.totalKg) / 1000)} />
        <KpiCard label="عدد الطلبات" value={formatNumber(s.pickups)} />
        <KpiCard label="متوسط وقت الاستجابة (دقيقة)" value={s.avgResponseMinutes == null ? '—' : formatNumber(s.avgResponseMinutes)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
        <div className="ftc-card" style={{ padding: 16 }}>
          <b>حسب المادة</b>
          <ul style={{ listStyle: 'none', padding: 0 }}>{s.byMaterial.map((r) => <li key={r.materialId}>{mat(r.materialId)}: {formatNumber(r.kg)} كجم</li>)}</ul>
        </div>
        <div className="ftc-card" style={{ padding: 16 }}>
          <b>حسب الحي</b>
          <ul style={{ listStyle: 'none', padding: 0 }}>{s.byDistrict.map((r) => <li key={r.district}>{r.district}: {formatNumber(r.kg)} كجم</li>)}</ul>
        </div>
      </div>
    </section>
  );
}

export function PayoutsSection() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({ queryKey: ['cc-payouts', from, to], queryFn: () => getPayouts({ from: from || undefined, to: to || undefined }) });
  const rows = q.data ?? [];
  const total = rows.reduce(
    (t, r) => ({ kg: t.kg + r.kg, value: t.value + r.valueEgp, paid: t.paid + r.paidToHouseholdsEgp, jobs: t.jobs + r.jobs }),
    { kg: 0, value: 0, paid: 0, jobs: 0 },
  );
  return (
    <section aria-label="مستحقات الجامعين">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 220px))', gap: 12, marginBottom: 12 }}>
        <TextField type="date" id="payouts-from" label="من تاريخ" dir="ltr" value={from} onChange={setFrom} />
        <TextField type="date" id="payouts-to" label="لحد تاريخ" dir="ltr" value={to} onChange={setTo} />
      </div>
      <p className="mini muted">الأرقام مسجّلة من الوزن والتسليم بس، النظام مش بيدفع فلوس.</p>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message="مقدرناش نحمّل المستحقات." />
      ) : rows.length === 0 ? (
        <EmptyState icon="list" title="مفيش وزن مسجّل في الفترة دي" />
      ) : (
        <div className="ftc-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr><th>الجامع</th><th>كجم</th><th>القيمة بسعر القائمة</th><th>اتدفع للأسر</th><th>عدد الطلبات</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorId}>
                  <td>{r.collectorName ?? <span dir="ltr">{r.collectorId}</span>}</td>
                  <td>{formatDecimal(r.kg)}</td>
                  <td>{formatEgp(r.valueEgp)}</td>
                  <td>{formatEgp(r.paidToHouseholdsEgp)}</td>
                  <td>{formatNumber(r.jobs)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>الإجمالي</td>
                <td>{formatDecimal(total.kg)}</td>
                <td>{formatEgp(total.value)}</td>
                <td>{formatEgp(total.paid)}</td>
                <td>{formatNumber(total.jobs)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
