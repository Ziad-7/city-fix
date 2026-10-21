'use client';

import { useOutbox, useQueuedCount } from '@/lib/outbox';
import { useSession } from '@/store';
import { toArabicDigits } from '@/utils/digits';
import { Icon } from './Icon';

/** "عندك بلاغ مستني النت": shown on every signed-in page while saved reports wait for a connection. */
export function OutboxBanner() {
  const userId = useSession((s) => s.userId);
  const count = useQueuedCount(userId);
  const flushing = useOutbox((s) => s.flushing);
  const flush = useOutbox((s) => s.flush);
  if (!userId || count === 0) return null;
  return (
    <div className="ftc-notice a-outbox" role="status" data-testid="outbox-banner">
      <Icon name="wifi" size={18} className="w-notice-ic" />
      <span className="w-grow">
        {count === 1 ? 'عندك بلاغ متحفظ على جهازك' : `عندك ${toArabicDigits(count)} بلاغات متحفظة على جهازك`}، وهيتبعت أول ما النت يرجع.
      </span>
      <button type="button" className="w-link" disabled={flushing} onClick={() => void flush(userId)}>
        {flushing ? 'بنبعت…' : 'ابعت دلوقتي'}
      </button>
    </div>
  );
}
