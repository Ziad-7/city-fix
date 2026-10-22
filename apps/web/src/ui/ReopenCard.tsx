'use client';

import { useState } from 'react';
import type { IncidentStatus } from '@/domain/types';
import { reopenReport } from '@/store';
import { Icon } from './Icon';

/**
 * "لسه المشكلة موجودة؟" on a resolved report: a short note and "افتح البلاغ تاني" (web version of the app's ReopenCard).
 * Mounted for every report; shown for a resolved one, and stays (as the confirmation) after it was reopened.
 */
export function ReopenCard({ incidentId, status }: { incidentId: string; status: IncidentStatus }) {
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
      setError(e instanceof Error && e.message ? e.message : 'معرفناش نفتح البلاغ، جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="ftc-notice" role="status" data-testid="reopen-done">
        <Icon name="check" size={20} className="w-notice-ic" />
        <span>اتفتح البلاغ تاني، وهنراجعه ونبلّغك بأي جديد.</span>
      </div>
    );
  }
  if (status !== 'resolved') return null;

  return (
    <section className="ftc-card w-stack" style={{ gap: 12 }} aria-labelledby="ro" data-testid="reopen-card">
      <h2 className="w-h3" id="ro">لسه المشكلة موجودة؟</h2>
      <p className="w-sub" style={{ margin: 0 }}>احكيلنا إيه اللي لسه مش مظبوط، وهنفتح البلاغ تاني ونراجعه.</p>
      <div className="ftc-field">
        <label className="w-sr" htmlFor="ro-note">إيه اللي لسه مش مظبوط؟</label>
        <textarea
          className="ftc-textarea"
          id="ro-note"
          data-testid="reopen-note"
          rows={2}
          maxLength={300}
          placeholder="مثلًا: الحفرة اتردمت بس النزلة لسه مكسورة"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? <span className="a-err" role="alert">{error}</span> : null}
      <div>
        <button className="ftc-btn ftc-btn--secondary" type="button" disabled={busy} onClick={() => void submit()} data-testid="reopen-submit">
          {busy ? <span className="a-spin" aria-hidden="true" /> : <Icon name="refresh" size={20} />}افتح البلاغ تاني
        </button>
      </div>
    </section>
  );
}
