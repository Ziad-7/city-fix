'use client';

import { useState } from 'react';
import { flushOutbox, useSession } from '@/store';
import { useOutbox } from '@/store/useOutbox';
import { toArabicDigits } from '@/utils/digits';
import { Icon } from './Icon';

/** "عندك بلاغ مستني النت": shown on every signed-in page while saved reports wait for a connection. */
export function OutboxBanner() {
  const userId = useSession((s) => s.userId);
  const count = useOutbox((s) => (userId ? s.items.filter((i) => i.userId === userId).length : 0));
  const [flushing, setFlushing] = useState(false);
  if (!userId || count === 0) return null;
  return (
    <div className="ftc-notice a-outbox" role="status" data-testid="outbox-banner">
      <Icon name="wifi" size={18} className="w-notice-ic" />
      <span className="w-grow">
        {count === 1 ? 'عندك بلاغ متحفظ على جهازك' : `عندك ${toArabicDigits(count)} بلاغات متحفظة على جهازك`}، وهيتبعت أول ما النت يرجع.
      </span>
      <button type="button" className="w-link" disabled={flushing} onClick={() => {
          setFlushing(true);
          void flushOutbox({ force: true }).finally(() => setFlushing(false));
        }}>
        {flushing ? 'بنبعت…' : 'ابعت دلوقتي'}
      </button>
    </div>
  );
}
