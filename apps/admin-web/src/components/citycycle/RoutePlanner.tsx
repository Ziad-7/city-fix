'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Checkbox, EmptyState, ErrorState, KpiCard, Notice, SelectField, Skeleton, TextField, useToast } from '@/components/ui';
import type { OptimizeRoutesResult, RecyclingPickup } from '@/domain/citycycle-types';
import { dual, formatDecimal, formatNumber } from '@/lib/format';
import { getPickups, isCityCycleDemo, optimizeErrorMessage, optimizeRoutes } from '@/services/citycycle';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <Skeleton variant="block" height={360} />,
});

const MAX_PICKUPS = 100;

const kgOf = (p: RecyclingPickup) => p.items.reduce((sum, i) => sum + i.estimatedKg, 0);
// The server rejects (422) a request whose items lack a positive estimated weight.
const hasWeights = (p: RecyclingPickup) =>
  p.items.length > 0 && p.items.every((i) => Number.isFinite(i.estimatedKg) && i.estimatedKg > 0);
const stopsLabel = (n: number) => dual(n, 'محطة واحدة', 'محطتين', (k) => `${k} محطات`, (k) => `${formatNumber(k)} محطة`);
const km = (meters: number) => formatDecimal(meters / 1000);

export function RoutesSection() {
  const toast = useToast();
  const demo = isCityCycleDemo();
  const q = useQuery({ queryKey: ['cc-pickups', 'requested'], queryFn: () => getPickups('requested') });
  // Only unassigned requests with a map position and estimated weights can be planned.
  const candidates = useMemo(
    () =>
      (q.data ?? [])
        .filter((p) => !p.collectorId && p.location?.lat != null && p.location?.lng != null && hasWeights(p))
        .slice(0, MAX_PICKUPS),
    [q.data],
  );
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [depotLat, setDepotLat] = useState('');
  const [depotLng, setDepotLng] = useState('');
  const [vehicles, setVehicles] = useState('1');
  const [capacity, setCapacity] = useState('');
  const [formError, setFormError] = useState('');
  const [depotUsed, setDepotUsed] = useState<{ lat: number; lng: number } | null>(null);

  const ticked = candidates.filter((p) => !unticked.has(p.id));
  const byId = useMemo(() => new Map(candidates.map((p) => [p.id, p])), [candidates]);

  const m = useMutation({
    mutationFn: optimizeRoutes,
    onError: (e) => toast.error(optimizeErrorMessage(e)),
  });

  const toggle = (id: string, on: boolean) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });

  const centroid = () => {
    if (ticked.length === 0) return;
    const lat = ticked.reduce((s, p) => s + p.location!.lat!, 0) / ticked.length;
    const lng = ticked.reduce((s, p) => s + p.location!.lng!, 0) / ticked.length;
    setDepotLat(lat.toFixed(5));
    setDepotLng(lng.toFixed(5));
  };

  const submit = () => {
    setFormError('');
    const lat = depotLat.trim() === '' ? NaN : Number(depotLat);
    const lng = depotLng.trim() === '' ? NaN : Number(depotLng);
    const cap = capacity.trim() === '' ? NaN : Number(capacity);
    if (ticked.length < 1) return setFormError('اختار طلب واحد على الأقل');
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return setFormError('اكتب إحداثيات نقطة البداية صح');
    }
    if (!Number.isFinite(cap) || cap <= 0 || cap > 10000) return setFormError('سعة المركبة لازم تكون أكبر من صفر ومتعدّيش 10000 كجم');
    setDepotUsed({ lat, lng });
    m.mutate({ pickupIds: ticked.map((p) => p.id), depot: { lat, lng }, vehicleCount: Number(vehicles), capacityKg: cap });
  };

  if (q.isLoading) return <Skeleton variant="block" height={160} />;
  if (q.error) return <ErrorState message="مقدرناش نحمّل طلبات التدوير." />;

  return (
    <section aria-label="مسارات الجمع">
      {demo && (
        <Notice tone="gold" className="mb-3">
          تخطيط المسارات محتاج السيرفر الحقيقي
        </Notice>
      )}
      {candidates.length === 0 ? (
        <EmptyState icon="list" title="مفيش طلبات تتخطط" message="الطلبات الجديدة اللي ليها موقع على الخريطة ووزن متوقع ومتوزعتش على جامع هتظهر هنا." />
      ) : (
        <div className="ftc-card" style={{ padding: 16 }}>
          <b>الطلبات اللي هتتخطط ({formatNumber(ticked.length)} من {formatNumber(candidates.length)})</b>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', maxHeight: 240, overflowY: 'auto' }}>
            {candidates.map((p) => (
              <li key={p.id} style={{ padding: '4px 0' }}>
                <Checkbox
                  id={`route-${p.id}`}
                  checked={!unticked.has(p.id)}
                  onChange={(on) => toggle(p.id, on)}
                  label={
                    <>
                      <span dir="ltr">{p.id}</span> · {p.location?.address || '—'} · {formatDecimal(kgOf(p))} كجم
                    </>
                  }
                />
              </li>
            ))}
          </ul>
          <b style={{ display: 'block', marginTop: 16 }}>نقطة البداية (المخزن أو نقطة التجميع)</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 8 }}>
            <TextField id="route-depot-lat" label="خط العرض" dir="ltr" value={depotLat} onChange={setDepotLat} />
            <TextField id="route-depot-lng" label="خط الطول" dir="ltr" value={depotLng} onChange={setDepotLng} />
            <SelectField
              id="route-vehicles"
              label="عدد المركبات"
              value={vehicles}
              onChange={setVehicles}
              options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: formatNumber(i + 1) }))}
            />
            <TextField id="route-capacity" label="سعة المركبة (كجم)" dir="ltr" value={capacity} onChange={setCapacity} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Button variant="secondary" size="sm" onClick={centroid} disabled={ticked.length === 0}>
              وسط الطلبات المختارة
            </Button>
            <Button loading={m.isPending} disabled={demo} onClick={submit}>
              اقترح المسارات
            </Button>
          </div>
          {formError && (
            <p className="ftc-error" role="alert" style={{ marginTop: 8 }}>
              {formError}
            </p>
          )}
        </div>
      )}
      {m.data && depotUsed && <RoutesResult result={m.data} byId={byId} depot={depotUsed} />}
    </section>
  );
}

function RoutesResult({ result, byId, depot }: { result: OptimizeRoutesResult; byId: Map<string, RecyclingPickup>; depot: { lat: number; lng: number } }) {
  const pins = result.routes.flatMap((r) =>
    r.stops.map((s, i) => ({
      id: s.pickupId,
      lat: s.lat,
      lng: s.lng,
      kind: 'assigned' as const,
      title: `مركبة ${r.vehicleIndex + 1} · محطة ${i + 1}`,
    })),
  );
  return (
    <div style={{ marginTop: 16 }}>
      <Notice tone="gold" className="mb-3">
        ده اقتراح ترتيب بس: مفيش طلب اتوزّع على جامع. المسافات خط مستقيم مش طرق فعلية.
      </Notice>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <KpiCard label="إجمالي المسافة" value={`${km(result.totalDistanceMeters)} كم`} />
        <KpiCard label="عدد المسارات" value={formatNumber(result.routes.length)} />
        <KpiCard label="طلبات مش متوزعة" value={formatNumber(result.unassignedPickupIds.length)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {result.routes.map((r) => (
          <div key={r.vehicleIndex} className="ftc-card" style={{ padding: 16 }}>
            <b>
              مركبة {formatNumber(r.vehicleIndex + 1)} · {stopsLabel(r.stops.length)} · {formatDecimal(r.loadKg)} كجم · {km(r.distanceMeters)} كم
            </b>
            <ol style={{ margin: '8px 0 0', paddingInlineStart: 24, listStyle: 'decimal' }}>
              {r.stops.map((s) => (
                <li key={s.pickupId}>
                  <span dir="ltr">{s.pickupId}</span> · {byId.get(s.pickupId)?.location?.address || '—'}
                </li>
              ))}
            </ol>
          </div>
        ))}
        {result.unassignedPickupIds.length > 0 && (
          <div className="ftc-card" style={{ padding: 16 }}>
            <b>مش متوزعة (السعة مش كفاية)</b>
            <ul style={{ margin: '8px 0 0', paddingInlineStart: 20 }}>
              {result.unassignedPickupIds.map((id) => (
                <li key={id} dir="ltr" style={{ textAlign: 'right' }}>
                  {id}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="ftc-card" style={{ height: 360, marginTop: 12, overflow: 'hidden' }}>
        <MapView pins={pins} center={[depot.lat, depot.lng]} zoom={13} cluster={false} />
      </div>
    </div>
  );
}
