'use client';

/* eslint-disable @next/next/no-img-element -- brand mark */
import Link from 'next/link';
import { useTr } from '@/i18n';
import { useOutbox } from '@/store/useOutbox';

/**
 * Shown in place of the form after a report was saved with no connection (rendered in place: with no
 * connection, navigating to another page may not load). Flips to "sent" once the outbox has sent it.
 */
export function QueuedNotice({ id }: { id: string }) {
  const tr = useTr();
  const sent = useOutbox((s) => !s.items.some((i) => i.id === id));
  return (
    <main className="ftc-web-main" id="main" style={{ paddingTop: 40 }}>
      <div className="u-card" role="status" data-testid="report-queued">
        <div className="u-hero">
          <span className="u-disc"><img src="/brand/cityfix-mark.svg" alt="" /></span>
          <h1>{sent ? tr('بلاغك اتبعت', 'Your report was sent') : tr('بلاغك اتحفظ', 'Your report was saved')}</h1>
          <p>{sent ? tr('النت رجع وبلاغك وصل. هتلاقيه في طلباتي.', 'The internet is back and your report went through. You’ll find it in My requests.') : tr('مفيش نت دلوقتي، فحفظنا البلاغ على جهازك. هيتبعت لوحده أول ما النت يرجع.', 'There’s no internet right now, so we saved the report on your device. It will be sent by itself as soon as the internet is back.')}</p>
        </div>
        <div className="u-body">
          <div className="u-foot">
            <Link className="ftc-btn ftc-btn--primary" href="/requests" style={{ minWidth: 200 }}>{tr('طلباتي', 'My requests')}</Link>
            <Link className="w-link" href="/">{tr('الرئيسية', 'Home')}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
