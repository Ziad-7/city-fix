'use client';

/* eslint-disable @next/next/no-img-element -- local photo previews (data URLs) */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { getCategory } from '@/domain/categories';
import { SEVERITY_LABEL_AR, STATUS_LABEL_AR, type AlreadyReported, type CategoryId, type DuplicateMatch, type Place, type TriageSuggestion } from '@/domain/types';
import { reportedBy } from '@/components/report/text';
import { useTr } from '@/i18n';
import { labelOfCategory, severityLabel, statusLabel } from '@/i18n/labels';
import { API_MODE } from '@/services';
import type { LocationState } from '@/lib/location';
import { MAX_SECONDS, useVoiceNote } from '@/lib/voice';
import { formatTimer } from '@/shared/components/report/voice';
import { localDigits } from '@/utils/digits';
import { formatDistance } from '@/utils/geo';
import { radioKeys } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { LocationPickerMap } from '@/ui/map';

export type TriageState = 'idle' | 'loading' | 'ready' | 'error';


/** Drop zone + up to two photo slots (close-up and wider shot, like the app). */
export function PhotoSlots({ photos, onAdd, onRemove, busy, error }: { photos: string[]; onAdd: (files: File[]) => void; onRemove: (i: number) => void; busy: boolean; error: string | null }) {
  const tr = useTr();
  const slotLabel = [tr('صورة ١ · قريبة', 'Photo 1 · Close-up'), tr('صورة ٢ · أوسع', 'Photo 2 · Wider')] as const;
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const full = photos.length >= 2;
  return (
    <div className="w-stack" style={{ gap: 8 }}>
      <div className="r-photos">
        {!full ? (
          // The zone itself opens the camera on a phone (`capture`); "أو من المعرض" is a second input without `capture`
          // so an already-taken photo can be picked. On a computer both just open the file dialog.
          <div
            className={`r-drop${over ? ' is-over' : ''}`}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('label,input')) input.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onAdd(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="ftc-icon-well">{busy ? <span className="a-spin" aria-hidden="true" /> : <Icon name="camera" size={26} />}</span>
            <b>{tr('صوّر المشكلة', 'Photograph the problem')}</b>
            <small>{tr('اسحب صورة هنا، أو اختار من جهازك', 'Drag a photo here, or choose one from your device')}</small>
            <label className="w-link" htmlFor="photo-gallery">{tr('أو من المعرض', 'or from gallery')}</label>
            <input
              ref={input}
              id="photo"
              data-testid="photo-camera"
              className="w-sr"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label={tr('صوّر المشكلة بالكاميرا', 'Take a photo of the problem')}
              onChange={(e) => {
                onAdd(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <input
              id="photo-gallery"
              data-testid="photo-input"
              className="w-sr"
              type="file"
              accept="image/*"
              multiple
              aria-label={tr('اختار صور من المعرض', 'Choose photos from your gallery')}
              onChange={(e) => {
                onAdd(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
        ) : null}
        {photos.map((p, i) => (
          <div className="r-ph" key={i}>
            <img src={p} alt={slotLabel[i]} />
            <span className="bd">{slotLabel[i]}</span>
            <button className="rm" type="button" aria-label={tr(`امسح ${slotLabel[i]}`, `Remove ${slotLabel[i]}`)} onClick={() => onRemove(i)}><Icon name="x" size={16} strokeWidth={2} /></button>
          </div>
        ))}
      </div>
      {error ? <span className="a-err" role="alert">{error}</span> : null}
    </div>
  );
}

/** "اقتراح الذكاء الاصطناعي": severity chip, summary, top-3 options with confidence bars. */
export function AiSuggestion({
  state, suggestion, selected, onSelect, onPickOther, onRetry,
}: { state: TriageState; suggestion: TriageSuggestion | null; selected: CategoryId | null; onSelect: (id: CategoryId) => void; onPickOther: () => void; onRetry: () => void }) {
  const tr = useTr();
  if (state === 'error') {
    return (
      <div className="r-ai" role="alert">
        <b style={{ color: 'var(--ftc-urgent-deep)' }}>{tr('معرفناش نحلّل البلاغ دلوقتي', "We couldn't analyse your report right now")}</b>
        <p>{tr('اختار التصنيف بنفسك وكمّل.', 'You can pick the type yourself and continue.')}</p>
        <div className="w-row" style={{ gap: 16 }}>
          <button className="w-link" type="button" onClick={onRetry}>{tr('جرّب تاني', 'Try again')}</button>
          <button className="w-link" type="button" onClick={onPickOther}>{tr('اختار التصنيف بنفسك', 'Choose the type yourself')}</button>
        </div>
      </div>
    );
  }
  if (!suggestion) {
    return (
      <div className="r-ai" aria-live="polite">
        <div className="r-ai__h"><span className="a-spin" aria-hidden="true" />{tr('الذكاء الاصطناعي بيحلّل بلاغك...', 'AI is analysing your report...')}</div>
      </div>
    );
  }
  const critical = suggestion.severity === 'critical';
  // Roving tabindex: the chosen option (or the first) is the one tab stop; the arrows move between the rest.
  const tabStop = Math.max(0, suggestion.options.findIndex((x) => x.categoryId === selected));
  return (
    <div className="r-ai" aria-label={tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')} data-testid="ai-suggestion">
      <div className="r-ai__h">
        <Icon name="sparkles" size={20} />{tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')}
        <span className={`sev ftc-chip ${critical ? 'ftc-chip--critical' : ''}`} style={critical ? { background: 'var(--ftc-urgent)' } : { background: '#fff', color: 'var(--ftc-red-deep)' }}>
          {severityLabel(suggestion.severity, SEVERITY_LABEL_AR[suggestion.severity])}
        </span>
      </div>
      <p>{suggestion.summary}</p>
      {suggestion.source === 'fallback' ? (
        <p className="ftc-caption" data-testid="ai-fallback-label">{tr('اقتراح محلي من الكلمات، مش نتيجة نموذج ذكاء اصطناعي.', 'Local keyword fallback; no AI model was used.')}</p>
      ) : null}
      <span className="ftc-caption" style={{ color: 'var(--ftc-ink-muted)' }}>{tr('اختار التصنيف الصح', 'Choose the right type')}</span>
      <div className="w-stack" style={{ gap: 8 }} role="radiogroup" aria-label={tr('التصنيف', 'Category')}>
        {suggestion.options.map((o, i) => {
          const on = o.categoryId === selected;
          const pct = Math.round(o.confidence * 100);
          return (
            <div
              key={o.categoryId}
              className={`r-opt${on ? ' is-on' : ''}`}
              role="radio"
              aria-checked={on}
              tabIndex={i === tabStop ? 0 : -1}
              data-testid={`ai-option-${o.categoryId}`}
              onClick={() => onSelect(o.categoryId)}
              onKeyDown={(e) => radioKeys(e, i, suggestion.options.length, (n) => onSelect(suggestion.options[n].categoryId))}
            >
              <span className="mk" />
              <span>{labelOfCategory(getCategory(o.categoryId))}</span>
              <span className="pct">{localDigits(pct)}{tr('٪', '%')}</span>
              <span className="ftc-bar"><span style={{ width: `${pct}%` }} /></span>
            </div>
          );
        })}
      </div>
      <button className="w-link" type="button" style={{ alignSelf: 'flex-start' }} onClick={onPickOther} data-testid="ai-pick-other">{tr('مش صح؟ اختار التصنيف بنفسك', 'Not right? Choose the type yourself')}</button>
    </div>
  );
}

/** "نوع المشكلة" row shown before there is a photo or description to analyse. */
export function CategoryRow({ selected, onPress }: { selected: CategoryId | null; onPress: () => void }) {
  const tr = useTr();
  const cat = selected ? getCategory(selected) : null;
  return (
    <button type="button" className="a-catrow" onClick={onPress} data-testid="category-row" aria-label={cat ? tr(`النوع: ${cat.labelAr}. غيّر النوع`, `Type: ${labelOfCategory(cat)}. Change the type`) : tr('اختار نوع المشكلة', 'Choose the type of problem')}>
      <span className="ftc-icon-well"><Icon name={cat ? cat.icon : 'search'} size={20} /></span>
      <span className="w-grow"><span className="ftc-caption" style={{ color: 'var(--ftc-ink-muted)' }}>{tr('نوع المشكلة', 'Type of problem')}</span><b>{cat ? labelOfCategory(cat) : tr('النوع لسه مش متحدد', 'No type chosen yet')}</b></span>
      <span className="w-link" style={{ textDecoration: 'none' }}>{cat ? tr('غيّر', 'Change') : tr('اختار', 'Choose')}</span>
    </button>
  );
}

/** "سجّل بصوتك": tap to talk, tap again to stop; the words are added to the description (see lib/voice). */
export function VoiceRow({ highlight, onText, onVoiceNote }: { highlight?: boolean; onText: (text: string) => void; onVoiceNote: (path: string) => void }) {
  const tr = useTr();
  const { engine, state, seconds, interim, error, toggle } = useVoiceNote({ onText, onVoiceNote });
  const recording = state === 'recording';
  const clock = `${localDigits(Math.floor(seconds / 60))}:${localDigits(String(seconds % 60).padStart(2, '0'))}`;
  const title = recording ? tr('بنسمعك…', 'Listening…') : state === 'working' ? tr('بنكتب كلامك…', 'Turning your voice into text…') : tr('سجّل بصوتك', 'Record a voice note');
  const sub = recording
    ? tr(`دوس تاني لما تخلص · ${clock} من ${formatTimer(MAX_SECONDS)}`, `Tap again when you're done · ${clock} of ${formatTimer(MAX_SECONDS)}`)
    : engine
      ? tr('قول المشكلة بالعامية وإحنا نكتبها', 'Say the problem in your own words and we’ll write it down')
      : tr('المتصفح ده مش بيدعم التسجيل. اكتب الوصف تحت.', 'This browser can’t record. Type the description below.');
  return (
    <div className="w-stack" style={{ gap: 6 }}>
      <div className={`r-voice${highlight && state === 'idle' && !error ? ' a-voice-hl' : ''}`}>
        <button
          className={`mic${recording ? ' a-mic-on' : ''}`}
          type="button"
          aria-label={recording ? tr('وقّف التسجيل', 'Stop recording') : tr('سجّل بصوتك', 'Record a voice note')}
          disabled={!engine || state === 'working'}
          onClick={toggle}
          data-testid="voice-button"
        >
          {state === 'working' ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : <Icon name={recording ? 'x' : 'mic'} size={20} />}
        </button>
        <span className="tx"><span className="w-t" aria-live="polite">{title}</span><span className="w-m">{sub}</span></span>
      </div>
      {API_MODE === 'api' ? <span className="ftc-help">{tr('التسجيل هيرتفع بشكل خاص ويتبعت لـ Gemini لتحويله لنص. النسخة المجانية ممكن تستخدم التسجيلات لتحسين منتجات Google؛ التسجيل اختياري وتقدر تكتب بدلًا منه.', 'The recording is uploaded privately and sent to Gemini for transcription. Google may use content submitted on its free tier to improve its products. Recording is optional; you can type instead.')}</span> : null}
      {interim ? <span className="ftc-help" aria-live="polite">«{interim}»</span> : null}
      {error ? <span className="a-err" role="alert" data-testid="voice-error">{error}</span> : null}
    </div>
  );
}

/** Leaflet pin picker + "استخدم موقعي" + the address line with "تعديل". */
export function LocationCard({
  place, state, error, onEditAddress, onLocate, onMove,
}: { place: Place; state: LocationState; error?: string; onEditAddress: (a: string) => void; onLocate: () => void; onMove: (p: { lat: number; lng: number }) => void }) {
  const tr = useTr();
  const [editing, setEditing] = useState(false);
  const showInput = editing || state === 'fallback' || !!error;
  return (
    <div className="w-stack" style={{ gap: 10 }}>
      <div className="r-loc">
        <div className="r-loc__map">
          <LocationPickerMap point={place} onMove={onMove} />
          <button type="button" className="ftc-btn ftc-btn--secondary ftc-btn--sm locate" onClick={onLocate} disabled={state === 'locating'} style={{ zIndex: 500 }}>
            {state === 'locating' ? <span className="a-spin" aria-hidden="true" /> : <Icon name="locate" size={18} />}{tr('استخدم موقعي', 'Use my location')}
          </button>
          <span className="hint" style={{ zIndex: 500 }}>{tr('اسحب الدبوس لمكان المشكلة', 'Drag the pin to where the problem is')}</span>
        </div>
        <div className="r-loc__addr">
          <Icon name="pin" size={20} />
          <span className="w-grow w-t" style={{ fontWeight: 500, fontSize: 14 }} data-testid="address-line">
            {place.address || (state === 'locating' ? tr('بنحدد العنوان…', 'Finding the address…') : tr('العنوان لسه مش مكتوب', 'No address yet'))}
          </span>
          <button type="button" className="w-link" onClick={() => setEditing((v) => !v)} aria-label={tr('تعديل العنوان', 'Edit the address')}>{editing ? tr('تم', 'Done') : tr('تعديل', 'Edit')}</button>
        </div>
      </div>
      {state === 'fallback' ? (
        <div className="ftc-notice" role="status">
          <Icon name="info" size={18} className="w-notice-ic" />
          <span>{tr('مقدرناش نحدد موقعك بدقة، فاخترنا وسط منطقتك. اكتب العنوان الصح تحت، أو حرّك الدبوس.', "We couldn't pinpoint your location, so we picked the centre of your area. Enter the right address below, or move the pin.")}</span>
        </div>
      ) : null}
      {showInput ? (
        <div className="ftc-field">
          <label className="ftc-label" htmlFor="addr">{tr('العنوان', 'Address')}</label>
          <input className="ftc-input" id="addr" data-testid="address-input" value={place.address} placeholder={tr('اسم الشارع والحي', 'Street and district')} aria-invalid={!!error} onChange={(e) => onEditAddress(e.target.value)} />
          {error ? <span className="a-err" role="alert">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Gold-bordered "ممكن تكون اتبلّغ عنها قبل كده" panel with join / dismiss. */
export function DuplicatePanel({ match, busy, onJoin, onDismiss }: { match: DuplicateMatch; busy: boolean; onJoin: () => void; onDismiss: () => void }) {
  const tr = useTr();
  const cat = getCategory(match.categoryId);
  return (
    <div className="r-dup" aria-label={tr('بلاغ مشابه', 'Similar report')} data-testid="duplicate-panel">
      <div className="r-dup__h">
        <span className="r-dup__ic"><Icon name="users" size={18} /></span>
        <span><b>{tr('ممكن تكون اتبلّغ عنها قبل كده', 'This may already be reported')}</b><span className="m">{tr('تابعها بدل ما تبلّغ تاني، وأولويتها هتزيد.', 'Follow it instead of reporting again, and its priority goes up.')}</span></span>
      </div>
      <div className="mini">
        <span className="w-thumb" aria-hidden="true"><Icon name={cat.icon} size={22} /></span>
        <span className="w-grow">
          <span className="w-t" style={{ fontSize: 14, lineHeight: '22px' }}>{match.title}</span>
          <span className="w-m">{reportedBy(match.followers)} · {statusLabel(match.status, STATUS_LABEL_AR[match.status])}</span>
        </span>
        <span className="dist">{formatDistance(match.distanceM)}</span>
      </div>
      <div className="btns">
        <button type="button" className="ftc-btn ftc-btn--gold" disabled={busy} onClick={onJoin} data-testid="dup-join">
          {busy ? <span className="a-spin" aria-hidden="true" /> : null}{tr('نفس المشكلة، تابعها', 'Same problem — follow it')}
        </button>
        <button type="button" className="ftc-btn ftc-btn--secondary w-neutral" disabled={busy} onClick={onDismiss} data-testid="dup-dismiss">{tr('لأ، مشكلة تانية', 'No, a different problem')}</button>
      </div>
    </div>
  );
}

/** Green "البلاغ ده متسجّل باسمك بالفعل" note: the citizen's own nearby report, never offered as "join". */
export function AlreadyReportedNote({ own }: { own: AlreadyReported }) {
  const tr = useTr();
  return (
    <div className="r-own" aria-label={tr('البلاغ ده متسجّل باسمك بالفعل', "You've already reported this")} data-testid="already-reported">
      <div className="r-dup__h">
        <span className="ic"><Icon name="check" size={18} strokeWidth={2.5} /></span>
        <span>
          <b style={{ font: '700 15px/24px var(--ftc-font-sans)', display: 'block' }}>{tr('البلاغ ده متسجّل باسمك بالفعل', "You've already reported this")}</b>
          <span className="w-m" style={{ fontSize: 13, lineHeight: '20px' }}>{tr(`${own.title} على بعد ${formatDistance(own.distanceM)}. مفيش داعي لبلاغ تاني، وتقدر تتابع بلاغك.`, `${own.title}, ${formatDistance(own.distanceM)} away. No need to report it again. You can follow your report.`)}</span>
        </span>
      </div>
      <Link className="ftc-btn ftc-btn--secondary" href={`/requests/${own.reportId}`} style={{ height: 46 }}>{tr('افتح بلاغك', 'Open your report')}</Link>
    </div>
  );
}
