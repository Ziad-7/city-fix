'use client';

import { Icon } from '../Icon';
import { binDisplayName, binStateLabel, binNeedsAttention, type Bin, type BinState } from '@/domain/citycycle';
import type { IconName } from '@/domain/types';
import { useTr } from '@/i18n';
import { localDigits } from '@/utils/digits';
import { relativeTime } from '@/utils/time';

/** State colours: green = fine, red = full, deep red = overheating, gold = weak battery, grey = no signal. Never colour-only (icon + label). */
export const BIN_COLOR: Record<BinState, string> = {
  ok: 'var(--ftc-status-resolved)',
  full: 'var(--ftc-urgent)',
  hot: 'var(--ftc-urgent-deep)',
  low_battery: 'var(--ftc-status-progress)',
  offline: 'var(--ftc-status-received)',
};

export const BIN_ICON: Record<BinState, IconName> = { ok: 'trash', full: 'alert-triangle', hot: 'flame', low_battery: 'zap', offline: 'wifi' };

/** Pill with the bin state: colour, icon and words. */
export function BinStateChip({ state }: { state: BinState }) {
  useTr();
  return (
    <span className="cc-bin-chip" style={{ ['--cc-bin' as string]: BIN_COLOR[state] }}>
      <Icon name={BIN_ICON[state]} size={14} />
      {binStateLabel(state)}
    </span>
  );
}

type SheetProps = {
  bin: Bin;
  busy?: boolean;
  /** null = not sent yet; 'sent' = a report was created; 'error' = it failed. */
  result: 'sent' | 'error' | null;
  onReportFull: () => void;
  onOpenRequests: () => void;
  onClose: () => void;
};

/** Card for the selected bin: state, fill level, temperature, and the "bin is full" report button. */
export function BinSheet({ bin, busy, result, onReportFull, onOpenRequests, onClose }: SheetProps) {
  const tr = useTr();
  const fill = bin.fillPct;
  return (
    <div className="cc-bin-sheet" data-testid="bin-sheet" style={{ ['--cc-bin' as string]: BIN_COLOR[bin.state] }}>
      <div className="cc-bin-top">
        <span className="cc-bin-icon"><Icon name={bin.kind === 'hub' ? 'scale' : 'trash'} size={22} /></span>
        <div className="cc-bin-text">
          <div className="cc-bin-title">{binDisplayName(bin)}</div>
          <div className="ftc-help">
            {bin.kind === 'hub' ? tr('نقطة تجميع بميزان', 'Collection hub with a scale') : tr('صندوق ذكي', 'Smart bin')} · {bin.id}
          </div>
        </div>
        <button type="button" className="cc-bin-close" aria-label={tr('إغلاق', 'Close')} onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="cc-bin-meta">
        <BinStateChip state={bin.state} />
        {fill !== undefined ? <span className="ftc-help">{tr('مليان', 'Filled')} {localDigits(Math.round(fill))}٪</span> : null}
        {bin.tempC !== undefined ? <span className="ftc-help">{localDigits(Math.round(bin.tempC))}°</span> : null}
        {bin.lastSeenAt ? <span className="ftc-help">{tr('آخر إشارة', 'Last signal')} {relativeTime(bin.lastSeenAt)}</span> : null}
      </div>

      {fill !== undefined ? (
        <div className="cc-bin-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill)}>
          <span style={{ width: `${Math.min(100, Math.max(0, fill))}%` }} />
        </div>
      ) : null}

      {binNeedsAttention(bin) ? (
        <p className="ftc-help cc-bin-warn">
          {bin.state === 'hot' ? tr('الصندوق سخن. لو فيه دخان أو ريحة حرق، التبليغ مهم.', 'The bin is hot. Report it if you see smoke or smell burning.') : tr('الصندوق وصل لآخره وبنبلّغ الحي أوتوماتيك.', 'The bin is full and the district is alerted automatically.')}
        </p>
      ) : null}

      {result === 'sent' ? (
        <div className="cc-bin-sent" aria-live="polite">
          <strong>{tr('بلاغك وصل، وهتتابعه من طلباتي.', 'Your report is in. Follow it in My requests.')}</strong>
          <button type="button" className="ftc-btn ftc-btn--secondary ftc-btn--sm" onClick={onOpenRequests} data-testid="bin-open-requests">{tr('طلباتي', 'My requests')}</button>
        </div>
      ) : (
        <div className="cc-bin-actions">
          <button type="button" className="ftc-btn ftc-btn--primary ftc-btn--sm ftc-btn--block" disabled={busy} onClick={onReportFull} data-testid="bin-report-full">
            <Icon name="alert-triangle" size={18} />
            {tr('بلّغ إن الصندوق مليان', 'Report: this bin is full')}
          </button>
          {result === 'error' ? <p className="ftc-help cc-bin-error" aria-live="polite">{tr('معرفناش نبعت البلاغ، جرّب تاني.', "We couldn't send the report. Try again.")}</p> : null}
        </div>
      )}
    </div>
  );
}
