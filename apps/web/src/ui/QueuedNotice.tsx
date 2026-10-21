'use client';

/* eslint-disable @next/next/no-img-element -- brand mark */
import Link from 'next/link';
import { useOutbox } from '@/store/useOutbox';

/**
 * Shown in place of the form after a report was saved with no connection (rendered in place: with no
 * connection, navigating to another page may not load). Flips to "sent" once the outbox has sent it.
 */
export function QueuedNotice({ id }: { id: string }) {
  const sent = useOutbox((s) => !s.items.some((i) => i.id === id));
  return (
    <main className="ftc-web-main" id="main" style={{ paddingTop: 40 }}>
      <div className="u-card" role="status" data-testid="report-queued">
        <div className="u-hero">
          <span className="u-disc"><img src="/brand/cityfix-mark.svg" alt="" /></span>
          <h1>{sent ? 'بلاغك اتبعت' : 'بلاغك اتحفظ'}</h1>
          <p>{sent ? 'النت رجع وبلاغك وصل. هتلاقيه في طلباتي.' : 'مفيش نت دلوقتي، فحفظنا البلاغ على جهازك. هيتبعت لوحده أول ما النت يرجع.'}</p>
        </div>
        <div className="u-body">
          <div className="u-foot">
            <Link className="ftc-btn ftc-btn--primary" href="/requests" style={{ minWidth: 200 }}>طلباتي</Link>
            <Link className="w-link" href="/">الرئيسية</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
