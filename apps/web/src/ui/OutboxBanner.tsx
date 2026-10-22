'use client';

import { useState } from 'react';
import { flushOutbox, useSession } from '@/store';
import { useOutbox } from '@/store/useOutbox';
import { localDigits } from '@/utils/digits';
import { useTr } from '@/i18n';
import { Icon } from './Icon';

/** "عندك بلاغ مستني النت": shown on every signed-in page while saved reports wait for a connection. */
export function OutboxBanner() {
  const tr = useTr();
  const userId = useSession((s) => s.userId);
  const count = useOutbox((s) => (userId ? s.items.filter((i) => i.userId === userId).length : 0));
  const [flushing, setFlushing] = useState(false);
  if (!userId || count === 0) return null;
  return (
    <div className="ftc-notice a-outbox" role="status" data-testid="outbox-banner">
      <Icon name="wifi" size={18} className="w-notice-ic" />
      <span className="w-grow">
        {count === 1 ? tr('عندك بلاغ متحفظ على جهازك', 'You have 1 report saved on your device') : tr(`عندك ${localDigits(count)} بلاغات متحفظة على جهازك`, `You have ${count} reports saved on your device`)}{tr('، وهيتبعت أول ما النت يرجع.', ', and they’ll be sent as soon as the internet is back.')}
      </span>
      <button type="button" className="w-link" disabled={flushing} onClick={() => {
          setFlushing(true);
          void flushOutbox({ force: true }).finally(() => setFlushing(false));
        }}>
        {flushing ? tr('بنبعت…', 'Sending…') : tr('ابعت دلوقتي', 'Send now')}
      </button>
    </div>
  );
}
