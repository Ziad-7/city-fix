'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { dayText, slotLabel } from '@/components/requests/labels';
import {
  awaitingConfirmation,
  canCancelPickup,
  estimateValue,
  formatEgp,
  formatKg,
  formatPrice,
  materialLabel,
  pickupModeLabel,
  sumKg,
  weighingTotals,
} from '@/domain/citycycle';
import { useLang, useTr } from '@/i18n';
import { buildPickupSteps, collectorDisplayName, materialsSummary } from '@/logic/citycycle';
import { usePageTitle } from '@/lib/usePageTitle';
import { useRecycling } from '@/store';
import { localDigits } from '@/utils/digits';
import { formatDateTime, formatTime } from '@/utils/time';
import { Icon } from '../Icon';
import { StateMessage } from '../StateMessage';
import { DemoPricesNote } from './DemoPricesNote';
import { MaterialLines } from './MaterialParts';
import { PickupStatusChip } from './PickupStatusChip';

/** Track a recycling pickup: summary, materials, collector, the weighing to confirm, timeline, cancel. */
export function PickupDetail({ id }: { id: string }) {
  const tr = useTr();
  const lang = useLang();
  const pickup = useRecycling((s) => s.pickups.find((p) => p.id === id) ?? null);
  const listStatus = useRecycling((s) => s.status);
  const prices = useRecycling((s) => s.prices);
  const loadPrices = useRecycling((s) => s.loadPrices);
  const refresh = useRecycling((s) => s.refresh);
  const loadPickup = useRecycling((s) => s.loadPickup);
  const cancelPickup = useRecycling((s) => s.cancelPickup);
  const confirmPickup = useRecycling((s) => s.confirmPickup);

  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const [fetchTry, setFetchTry] = useState(0);
  const [busy, setBusy] = useState<'cancel' | 'confirm' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  // A direct visit has no list yet: load it, then fetch the one pickup if it is still unknown.
  useEffect(() => {
    if (listStatus === 'idle') void refresh();
  }, [listStatus, refresh]);

  const listSettled = listStatus === 'ready' || listStatus === 'error';
  useEffect(() => {
    if (pickup || !listSettled) return;
    let cancelled = false;
    loadPickup(id)
      .then((found) => !cancelled && setFetchState(found ? 'idle' : 'missing'))
      .catch(() => !cancelled && setFetchState('error'));
    return () => {
      cancelled = true;
    };
  }, [pickup, listSettled, id, fetchTry, loadPickup]);

  // The future-step labels are written when the steps are built: rebuild on a language switch.
  const steps = useMemo(() => (pickup ? buildPickupSteps(pickup) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickup, lang]);

  const back = <Link className="w-back" href="/requests"><Icon name="arrow-back" size={18} />{tr('طلباتي', 'My requests')}</Link>;
  usePageTitle(tr('متابعة طلب التدوير', 'Track your recycling pickup'));

  if (!pickup) {
    return (
      <main className="ftc-web-main" id="main">
        {back}
        {fetchState === 'missing' ? (
          <StateMessage icon="search" title={tr('مش لاقيين الطلب ده', "We couldn't find this pickup")} body={tr('ممكن يكون اتمسح أو الرابط مش صح. ارجع لقايمة طلباتك.', 'It may have been deleted, or the link is wrong. Go back to your requests.')} actionLabel={tr('طلباتي', 'My requests')} actionHref="/requests" />
        ) : fetchState === 'error' ? (
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الطلب', "We couldn't load this pickup")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => { setFetchState('loading'); setFetchTry((n) => n + 1); }} />
        ) : (
          <StateMessage loading title={tr('بنجيب التفاصيل…', 'Loading the details…')} />
        )}
      </main>
    );
  }

  const title = `${tr('جمع تدوير', 'Recycling pickup')} · ${materialsSummary(pickup.items, (n) => tr(`+${localDigits(n)}`, `+${n}`))}`;
  const calc = estimateValue(pickup.items, prices);
  const est = pickup.estimatedValueEgp ?? calc.valueEgp;
  const partial = prices.length > 0 && calc.unpriced.length > 0;
  const collector = collectorDisplayName(pickup);
  const totals = weighingTotals(pickup.weighings);
  const sorry = tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again');

  const run = async (kind: 'cancel' | 'confirm', fn: () => Promise<void>) => {
    setBusy(kind);
    setActionError(null);
    try {
      await fn();
      setConfirmCancel(false);
    } catch (e) {
      setActionError(e instanceof Error && e.message ? e.message : sorry);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="ftc-web-main" id="main">
      {back}
      <div className="w-page-head">
        <h1 className="w-h1">{tr('متابعة طلب التدوير', 'Track your recycling pickup')}</h1>
      </div>
      <div className="t-grid">
        <div className="t-main">
          <section className="ftc-card t-sum" aria-label={tr('ملخص الطلب', 'Pickup summary')}>
            <div className="t-ph"><span className="a-ph-icon"><Icon name="recycle" size={48} /></span></div>
            <div>
              <h2 data-testid="detail-title">{title}</h2>
              <div className="t-meta">
                <bdi dir="ltr">#{pickup.id}</bdi> · {tr('اتطلب', 'Requested')} {formatDateTime(pickup.createdAt)}
                <PickupStatusChip status={pickup.status} />
              </div>
              <div className="t-info">
                <div><span>{tr('الميعاد', 'Scheduled')}</span><b>{dayText(pickup.day)} · {slotLabel(pickup.slot)}</b></div>
                <div><span>{tr('الطريقة', 'How')}</span><b>{pickupModeLabel(pickup.mode)}</b></div>
              </div>
              <div className="cc-pk-place">
                <Icon name="pin" size={16} />
                <span>{pickup.location.address}{pickup.location.landmark ? ` · ${pickup.location.landmark}` : ''}</span>
              </div>
            </div>
          </section>

          <section className="ftc-card t-prio" aria-labelledby="pk-mat">
            <h2 className="w-h3" id="pk-mat" style={{ marginBottom: 14 }}>{tr('الخامات', 'Materials')}</h2>
            <MaterialLines items={pickup.items} prices={prices} />
            <div className="cc-pk-row"><span>{tr('الوزن التقريبي', 'Estimated weight')}</span><b>{formatKg(sumKg(pickup.items))}</b></div>
            {pickup.mode === 'paid' ? (
              <div className="cc-pk-row">
                <span>{tr('القيمة التقريبية', 'Estimated value')}</span>
                <b data-testid="pickup-estimate">{est !== undefined ? `${partial ? tr('من ', 'From ') : ''}${formatEgp(est)}` : formatPrice(null)}</b>
              </div>
            ) : null}
            <DemoPricesNote />
          </section>

          {collector ? (
            <section className="ftc-card cc-pk-collector" aria-label={tr('الجامع', 'Collector')}>
              <span className="cc-pk-badge"><Icon name="truck" size={22} /></span>
              <span className="w-grow">
                <b>{tr(`الجامع: ${collector}`, `Collector: ${collector}`)}</b>
                <span className="cc-pk-verified"><Icon name="shield-check" size={14} />{tr('جامع موثّق من الحي', 'Verified by the district')}</span>
              </span>
            </section>
          ) : null}

          {pickup.weighings.length > 0 ? (
            <section className="ftc-card t-prio" aria-labelledby="pk-w" data-testid="pickup-weighings">
              <h2 className="w-h3" id="pk-w" style={{ marginBottom: 14 }}>{tr('الوزن الفعلي', 'Actual weight')}</h2>
              {totals.byMaterial.map((m) => {
                const unpriced = pickup.weighings.some((w) => w.materialId === m.materialId && w.valueEgp === null);
                return (
                  <div className="cc-pk-row" key={m.materialId}>
                    <span>{materialLabel(m.materialId)}</span>
                    <b>{formatKg(m.kg)}{pickup.mode === 'paid' ? ` · ${unpriced ? formatPrice(null) : formatEgp(m.valueEgp)}` : ''}</b>
                  </div>
                );
              })}
              <div className="cc-pk-row cc-pk-total">
                <span>{tr('الإجمالي', 'Total')}</span>
                <b>{formatKg(pickup.totalKg ?? totals.totalKg)}{pickup.mode === 'paid' && pickup.totalValueEgp !== undefined ? ` · ${formatEgp(pickup.totalValueEgp)}` : ''}</b>
              </div>
              {pickup.mode === 'paid' && pickup.paidToHouseholdEgp !== undefined ? (
                <p className="ftc-small cc-pk-note">
                  {tr(`الجامع سجّل إنه دفع لك ${formatEgp(pickup.paidToHouseholdEgp)} كاش.`, `The collector recorded paying you ${formatEgp(pickup.paidToHouseholdEgp)} in cash.`)}
                </p>
              ) : null}
            </section>
          ) : null}

          {awaitingConfirmation(pickup) ? (
            <section className="ftc-card cc-pk-confirm" aria-labelledby="pk-c" data-testid="pickup-confirm-card">
              <b id="pk-c">{tr('الأرقام دي صح؟', 'Are these numbers right?')}</b>
              <p>{tr('راجع الوزن اللي الجامع سجّله. لما تأكّده بيتحسب في تأثيرك.', 'Check the weight the collector recorded. Once you confirm, it counts toward your impact.')}</p>
              <p className="cc-pk-sum">
                {formatKg(pickup.totalKg ?? totals.totalKg)}
                {pickup.mode === 'paid' ? ` · ${totals.hasUnpriced ? formatPrice(null) : formatEgp(pickup.totalValueEgp ?? totals.totalValueEgp)}` : ''}
              </p>
              <button className="ftc-btn ftc-btn--primary" type="button" disabled={busy !== null} onClick={() => void run('confirm', () => confirmPickup(pickup.id))} data-testid="pickup-confirm">
                {busy === 'confirm' ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : <Icon name="check" size={20} strokeWidth={2} />}{tr('أكّد الوزن', 'Confirm the weight')}
              </button>
            </section>
          ) : null}

          <section className="ftc-card t-tl" aria-labelledby="pk-tl">
            <h2 className="w-h3" id="pk-tl" style={{ marginBottom: 16 }}>{tr('مراحل الطلب', 'Request progress')}</h2>
            <ol className="ftc-timeline" data-testid="timeline">
              {steps.map((s) => (
                <li key={s.key} className={s.state === 'done' ? 'is-done' : s.state === 'current' ? 'is-current' : undefined} aria-current={s.state === 'current' ? 'step' : undefined}>
                  <b>{s.title}</b>
                  {s.detail ? <span className="n">{s.detail}</span> : null}
                  {s.at ? <span className="tm">{formatTime(s.at)}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          {actionError ? <span className="a-err" role="alert" style={{ textAlign: 'center' }}>{actionError}</span> : null}

          {canCancelPickup(pickup) ? (
            confirmCancel ? (
              <div className="ftc-card cc-pk-cancel" role="alertdialog" aria-labelledby="pk-cq" data-testid="pickup-cancel-dialog">
                <b id="pk-cq">{tr('تلغي الطلب؟', 'Cancel this pickup?')}</b>
                <p>{tr('الطلب هيتلغي ومحدش هيجي ياخد الخامات.', 'The pickup will be cancelled and nobody will come for the materials.')}</p>
                <div className="w-row">
                  <button className="ftc-btn ftc-btn--primary" type="button" disabled={busy !== null} onClick={() => void run('cancel', () => cancelPickup(pickup.id))} data-testid="pickup-cancel-confirm">
                    {busy === 'cancel' ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('أيوه، إلغاء الطلب', 'Yes, cancel it')}
                  </button>
                  <button className="ftc-btn ftc-btn--secondary w-neutral" type="button" disabled={busy !== null} onClick={() => setConfirmCancel(false)}>{tr('لأ', 'No')}</button>
                </div>
              </div>
            ) : (
              <button className="ftc-btn ftc-btn--secondary" type="button" onClick={() => setConfirmCancel(true)} data-testid="pickup-cancel">{tr('إلغاء الطلب', 'Cancel this pickup')}</button>
            )
          ) : null}
        </div>
      </div>
    </main>
  );
}
