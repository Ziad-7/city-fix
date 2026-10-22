'use client';

/* eslint-disable @next/next/no-img-element -- local photo previews (data URLs) */
import Link from 'next/link';
import { useRef, useState } from 'react';
import { getCategory } from '@/domain/categories';
import { SEVERITY_LABEL_AR, STATUS_LABEL_AR, type AlreadyReported, type CategoryId, type DuplicateMatch, type Place, type TriageSuggestion } from '@/domain/types';
import { reportedByAr } from '@/components/report/text';
import { API_MODE } from '@/services';
import type { LocationState } from '@/lib/location';
import { MAX_SECONDS, useVoiceNote } from '@/lib/voice';
import { formatTimer } from '@/shared/components/report/voice';
import { toArabicDigits } from '@/utils/digits';
import { formatDistanceAr } from '@/utils/geo';
import { radioKeys } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { LocationPickerMap } from '@/ui/map';

export type TriageState = 'idle' | 'loading' | 'ready' | 'error';

const SLOT_LABEL = ['صورة ١ · قريبة', 'صورة ٢ · أوسع'] as const;

/** Drop zone + up to two photo slots (close-up and wider shot, like the app). */
export function PhotoSlots({ photos, onAdd, onRemove, busy, error }: { photos: string[]; onAdd: (files: File[]) => void; onRemove: (i: number) => void; busy: boolean; error: string | null }) {
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
            <b>صوّر المشكلة</b>
            <small>اسحب صورة هنا، أو اختار من جهازك</small>
            <label className="w-link" htmlFor="photo-gallery">أو من المعرض</label>
            <input
              ref={input}
              id="photo"
              data-testid="photo-camera"
              className="w-sr"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="صوّر المشكلة بالكاميرا"
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
              aria-label="اختار صور من المعرض"
              onChange={(e) => {
                onAdd(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
        ) : null}
        {photos.map((p, i) => (
          <div className="r-ph" key={i}>
            <img src={p} alt={SLOT_LABEL[i]} />
            <span className="bd">{SLOT_LABEL[i]}</span>
            <button className="rm" type="button" aria-label={`امسح ${SLOT_LABEL[i]}`} onClick={() => onRemove(i)}><Icon name="x" size={16} strokeWidth={2} /></button>
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
  if (state === 'error') {
    return (
      <div className="r-ai" role="alert">
        <b style={{ color: 'var(--ftc-urgent-deep)' }}>معرفناش نحلّل البلاغ دلوقتي</b>
        <p>اختار التصنيف بنفسك وكمّل.</p>
        <div className="w-row" style={{ gap: 16 }}>
          <button className="w-link" type="button" onClick={onRetry}>جرّب تاني</button>
          <button className="w-link" type="button" onClick={onPickOther}>اختار التصنيف بنفسك</button>
        </div>
      </div>
    );
  }
  if (!suggestion) {
    return (
      <div className="r-ai" aria-live="polite">
        <div className="r-ai__h"><span className="a-spin" aria-hidden="true" />الذكاء الاصطناعي بيحلّل بلاغك...</div>
      </div>
    );
  }
  const critical = suggestion.severity === 'critical';
  // Roving tabindex: the chosen option (or the first) is the one tab stop; the arrows move between the rest.
  const tabStop = Math.max(0, suggestion.options.findIndex((x) => x.categoryId === selected));
  return (
    <div className="r-ai" aria-label="اقتراح الذكاء الاصطناعي" data-testid="ai-suggestion">
      <div className="r-ai__h">
        <Icon name="sparkles" size={20} />اقتراح الذكاء الاصطناعي
        <span className={`sev ftc-chip ${critical ? 'ftc-chip--critical' : ''}`} style={critical ? { background: 'var(--ftc-urgent)' } : { background: '#fff', color: 'var(--ftc-red-deep)' }}>
          {SEVERITY_LABEL_AR[suggestion.severity]}
        </span>
      </div>
      <p>{suggestion.summary}</p>
      {suggestion.source === 'fallback' ? (
        <p className="ftc-caption" data-testid="ai-fallback-label">اقتراح محلي من الكلمات، مش نتيجة نموذج ذكاء اصطناعي.</p>
      ) : null}
      <span className="ftc-caption" style={{ color: 'var(--ftc-ink-muted)' }}>اختار التصنيف الصح</span>
      <div className="w-stack" style={{ gap: 8 }} role="radiogroup" aria-label="التصنيف">
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
              <span>{getCategory(o.categoryId).labelAr}</span>
              <span className="pct">{toArabicDigits(pct)}٪</span>
              <span className="ftc-bar"><span style={{ width: `${pct}%` }} /></span>
            </div>
          );
        })}
      </div>
      <button className="w-link" type="button" style={{ alignSelf: 'flex-start' }} onClick={onPickOther} data-testid="ai-pick-other">مش صح؟ اختار التصنيف بنفسك</button>
    </div>
  );
}

/** "نوع المشكلة" row shown before there is a photo or description to analyse. */
export function CategoryRow({ selected, onPress }: { selected: CategoryId | null; onPress: () => void }) {
  const cat = selected ? getCategory(selected) : null;
  return (
    <button type="button" className="a-catrow" onClick={onPress} data-testid="category-row" aria-label={cat ? `النوع: ${cat.labelAr}. غيّر النوع` : 'اختار نوع المشكلة'}>
      <span className="ftc-icon-well"><Icon name={cat ? cat.icon : 'search'} size={20} /></span>
      <span className="w-grow"><span className="ftc-caption" style={{ color: 'var(--ftc-ink-muted)' }}>نوع المشكلة</span><b>{cat ? cat.labelAr : 'النوع لسه مش متحدد'}</b></span>
      <span className="w-link" style={{ textDecoration: 'none' }}>{cat ? 'غيّر' : 'اختار'}</span>
    </button>
  );
}

/** "سجّل بصوتك": tap to talk, tap again to stop; the words are added to the description (see lib/voice). */
export function VoiceRow({ highlight, onText, onVoiceNote }: { highlight?: boolean; onText: (text: string) => void; onVoiceNote: (path: string) => void }) {
  const { engine, state, seconds, interim, error, toggle } = useVoiceNote({ onText, onVoiceNote });
  const recording = state === 'recording';
  const clock = `${toArabicDigits(Math.floor(seconds / 60))}:${toArabicDigits(String(seconds % 60).padStart(2, '0'))}`;
  const title = recording ? 'بنسمعك…' : state === 'working' ? 'بنكتب كلامك…' : 'سجّل بصوتك';
  const sub = recording
    ? `دوس تاني لما تخلص · ${clock} من ${formatTimer(MAX_SECONDS)}`
    : engine
      ? 'قول المشكلة بالعامية وإحنا نكتبها'
      : 'المتصفح ده مش بيدعم التسجيل. اكتب الوصف تحت.';
  return (
    <div className="w-stack" style={{ gap: 6 }}>
      <div className={`r-voice${highlight && state === 'idle' && !error ? ' a-voice-hl' : ''}`}>
        <button
          className={`mic${recording ? ' a-mic-on' : ''}`}
          type="button"
          aria-label={recording ? 'وقّف التسجيل' : 'سجّل بصوتك'}
          disabled={!engine || state === 'working'}
          onClick={toggle}
          data-testid="voice-button"
        >
          {state === 'working' ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : <Icon name={recording ? 'x' : 'mic'} size={20} />}
        </button>
        <span className="tx"><span className="w-t" aria-live="polite">{title}</span><span className="w-m">{sub}</span></span>
      </div>
      {API_MODE === 'api' ? <span className="ftc-help">التسجيل هيرتفع بشكل خاص ويتبعت لـ Gemini لتحويله لنص. النسخة المجانية ممكن تستخدم التسجيلات لتحسين منتجات Google؛ التسجيل اختياري وتقدر تكتب بدلًا منه.</span> : null}
      {interim ? <span className="ftc-help" aria-live="polite">«{interim}»</span> : null}
      {error ? <span className="a-err" role="alert" data-testid="voice-error">{error}</span> : null}
    </div>
  );
}

/** Leaflet pin picker + "استخدم موقعي" + the address line with "تعديل". */
export function LocationCard({
  place, state, error, onEditAddress, onLocate, onMove,
}: { place: Place; state: LocationState; error?: string; onEditAddress: (a: string) => void; onLocate: () => void; onMove: (p: { lat: number; lng: number }) => void }) {
  const [editing, setEditing] = useState(false);
  const showInput = editing || state === 'fallback' || !!error;
  return (
    <div className="w-stack" style={{ gap: 10 }}>
      <div className="r-loc">
        <div className="r-loc__map">
          <LocationPickerMap point={place} onMove={onMove} />
          <button type="button" className="ftc-btn ftc-btn--secondary ftc-btn--sm locate" onClick={onLocate} disabled={state === 'locating'} style={{ zIndex: 500 }}>
            {state === 'locating' ? <span className="a-spin" aria-hidden="true" /> : <Icon name="locate" size={18} />}استخدم موقعي
          </button>
          <span className="hint" style={{ zIndex: 500 }}>اسحب الدبوس لمكان المشكلة</span>
        </div>
        <div className="r-loc__addr">
          <Icon name="pin" size={20} />
          <span className="w-grow w-t" style={{ fontWeight: 500, fontSize: 14 }} data-testid="address-line">
            {place.address || (state === 'locating' ? 'بنحدد العنوان…' : 'العنوان لسه مش مكتوب')}
          </span>
          <button type="button" className="w-link" onClick={() => setEditing((v) => !v)} aria-label="تعديل العنوان">{editing ? 'تم' : 'تعديل'}</button>
        </div>
      </div>
      {state === 'fallback' ? (
        <div className="ftc-notice" role="status">
          <Icon name="info" size={18} className="w-notice-ic" />
          <span>مقدرناش نحدد موقعك بدقة، فاخترنا وسط منطقتك. اكتب العنوان الصح تحت، أو حرّك الدبوس.</span>
        </div>
      ) : null}
      {showInput ? (
        <div className="ftc-field">
          <label className="ftc-label" htmlFor="addr">العنوان</label>
          <input className="ftc-input" id="addr" data-testid="address-input" value={place.address} placeholder="اسم الشارع والحي" aria-invalid={!!error} onChange={(e) => onEditAddress(e.target.value)} />
          {error ? <span className="a-err" role="alert">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Gold-bordered "ممكن تكون اتبلّغ عنها قبل كده" panel with join / dismiss. */
export function DuplicatePanel({ match, busy, onJoin, onDismiss }: { match: DuplicateMatch; busy: boolean; onJoin: () => void; onDismiss: () => void }) {
  const cat = getCategory(match.categoryId);
  return (
    <div className="r-dup" aria-label="بلاغ مشابه" data-testid="duplicate-panel">
      <div className="r-dup__h">
        <span className="r-dup__ic"><Icon name="users" size={18} /></span>
        <span><b>ممكن تكون اتبلّغ عنها قبل كده</b><span className="m">تابعها بدل ما تبلّغ تاني، وأولويتها هتزيد.</span></span>
      </div>
      <div className="mini">
        <span className="w-thumb" aria-hidden="true"><Icon name={cat.icon} size={22} /></span>
        <span className="w-grow">
          <span className="w-t" style={{ fontSize: 14, lineHeight: '22px' }}>{match.title}</span>
          <span className="w-m">{reportedByAr(match.followers)} · {STATUS_LABEL_AR[match.status]}</span>
        </span>
        <span className="dist">{formatDistanceAr(match.distanceM)}</span>
      </div>
      <div className="btns">
        <button type="button" className="ftc-btn ftc-btn--gold" disabled={busy} onClick={onJoin} data-testid="dup-join">
          {busy ? <span className="a-spin" aria-hidden="true" /> : null}نفس المشكلة، تابعها
        </button>
        <button type="button" className="ftc-btn ftc-btn--secondary w-neutral" disabled={busy} onClick={onDismiss} data-testid="dup-dismiss">لأ، مشكلة تانية</button>
      </div>
    </div>
  );
}

/** Green "البلاغ ده متسجّل باسمك بالفعل" note: the citizen's own nearby report, never offered as "join". */
export function AlreadyReportedNote({ own }: { own: AlreadyReported }) {
  return (
    <div className="r-own" aria-label="البلاغ ده متسجّل باسمك بالفعل" data-testid="already-reported">
      <div className="r-dup__h">
        <span className="ic"><Icon name="check" size={18} strokeWidth={2.5} /></span>
        <span>
          <b style={{ font: '700 15px/24px var(--ftc-font-sans)', display: 'block' }}>البلاغ ده متسجّل باسمك بالفعل</b>
          <span className="w-m" style={{ fontSize: 13, lineHeight: '20px' }}>{own.title} على بعد {formatDistanceAr(own.distanceM)}. مفيش داعي لبلاغ تاني، وتقدر تتابع بلاغك.</span>
        </span>
      </div>
      <Link className="ftc-btn ftc-btn--secondary" href={`/requests/${own.reportId}`} style={{ height: 46 }}>افتح بلاغك</Link>
    </div>
  );
}
