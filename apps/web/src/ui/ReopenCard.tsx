'use client';

import { useState } from 'react';
import type { IncidentStatus } from '@/domain/types';
import { useTr } from '@/i18n';
import { reopenReport } from '@/store';
import { Icon } from './Icon';

/**
 * "لسه المشكلة موجودة؟" on a resolved report: a short note and "افتح البلاغ تاني" (web version of the app's ReopenCard).
 * Mounted for every report; shown for a resolved one, and stays (as the confirmation) after it was reopened.
 */
export function ReopenCard({ incidentId, status }: { incidentId: string; status: IncidentStatus }) {
  const tr = useTr();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reopenReport(incidentId, note.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tr('معرفناش نفتح البلاغ، جرّب تاني', 'We couldn’t reopen the report. Try again'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="ftc-notice" role="status" data-testid="reopen-done">
        <Icon name="check" size={20} className="w-notice-ic" />
        <span>{tr('اتفتح البلاغ تاني، وهنراجعه ونبلّغك بأي جديد.', 'The report is open again. We’ll review it and let you know about any update.')}</span>
      </div>
    );
  }
  if (status !== 'resolved') return null;

  return (
    <section className="ftc-card w-stack" style={{ gap: 12 }} aria-labelledby="ro" data-testid="reopen-card">
      <h2 className="w-h3" id="ro">{tr('لسه المشكلة موجودة؟', 'Still a problem?')}</h2>
      <p className="w-sub" style={{ margin: 0 }}>{tr('احكيلنا إيه اللي لسه مش مظبوط، وهنفتح البلاغ تاني ونراجعه.', 'Tell us what’s still wrong, and we’ll reopen the report and review it.')}</p>
      <div className="ftc-field">
        <label className="w-sr" htmlFor="ro-note">{tr('إيه اللي لسه مش مظبوط؟', 'What’s still wrong?')}</label>
        <textarea
          className="ftc-textarea"
          id="ro-note"
          data-testid="reopen-note"
          rows={2}
          maxLength={300}
          placeholder={tr('مثلًا: الحفرة اتردمت بس النزلة لسه مكسورة', 'For example: the pothole was filled but the edge is still broken')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? <span className="a-err" role="alert">{error}</span> : null}
      <div>
        <button className="ftc-btn ftc-btn--secondary" type="button" disabled={busy} onClick={() => void submit()} data-testid="reopen-submit">
          {busy ? <span className="a-spin" aria-hidden="true" /> : <Icon name="refresh" size={20} />}{tr('افتح البلاغ تاني', 'Reopen the report')}
        </button>
      </div>
    </section>
  );
}
