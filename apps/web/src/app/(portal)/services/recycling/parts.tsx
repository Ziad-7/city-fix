'use client';

/* eslint-disable @next/next/no-img-element -- local photo preview (data URL) */
import { formatEgp, materialLabel, type MaterialId, type WasteClassification } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { localDigits } from '@/utils/digits';
import { Icon } from '@/ui/Icon';
import { KgStepper, MaterialBadge } from '@/ui/citycycle';

export type Suggestion = { state: 'loading' } | { state: 'ready'; value: WasteClassification } | { state: 'none' };

/** One row per chosen material: badge, name, − kg +. */
export function WeightRows({ items, onChange }: { items: { materialId: MaterialId; estimatedKg: number }[]; onChange: (id: MaterialId, kg: number) => void }) {
  return (
    <div className="cc-material-lines">
      {items.map((it) => (
        <div key={it.materialId} className="cc-material-line" data-testid={`weight-${it.materialId}`}>
          <MaterialBadge id={it.materialId} size={34} />
          <span className="w-grow w-t" style={{ fontSize: 14 }}>{materialLabel(it.materialId)}</span>
          <KgStepper value={it.estimatedKg} onChange={(kg) => onChange(it.materialId, kg)} testId={`kg-${it.materialId}`} />
        </div>
      ))}
    </div>
  );
}

/** Photo box, the camera/gallery pickers, and the AI suggestion chips the citizen confirms or changes. */
export function PhotoBlock({
  photo, busy, problem, suggestion, selected, onFiles, onRemove, onAccept,
}: {
  photo: string | null;
  busy: boolean;
  problem: string | null;
  suggestion: Suggestion;
  selected: ReadonlySet<MaterialId>;
  onFiles: (files: File[]) => void;
  onRemove: () => void;
  onAccept: (id: MaterialId, value: WasteClassification) => void;
}) {
  const tr = useTr();
  return (
    <>
      {photo ? (
        <div className="r-photos">
          <div className="r-ph">
            <img src={photo} alt={tr('صورة الخامات', 'Photo of the materials')} />
            <button className="rm" type="button" aria-label={tr('امسح الصورة', 'Remove photo')} onClick={onRemove}><Icon name="x" size={16} strokeWidth={2} /></button>
          </div>
        </div>
      ) : (
        <div className="v-pair">
          {/* Camera: opens the phone camera. Gallery: no `capture`, so a photo that was already taken can be picked. */}
          <label className="ftc-btn ftc-btn--secondary" htmlFor="recycling-camera">{busy ? <span className="a-spin" aria-hidden="true" /> : <Icon name="camera" size={20} />}{tr('صوّر', 'Take a photo')}</label>
          <label className="ftc-btn ftc-btn--secondary" htmlFor="recycling-gallery"><Icon name="image" size={20} />{tr('من المعرض', 'From gallery')}</label>
          <input id="recycling-camera" data-testid="recycling-photo-camera" className="w-sr" type="file" accept="image/*" capture="environment" onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          <input id="recycling-gallery" data-testid="recycling-photo-gallery" className="w-sr" type="file" accept="image/*" onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        </div>
      )}
      {problem ? <span className="a-err" role="alert">{problem}</span> : null}
      {suggestion.state === 'loading' ? <span className="ftc-help" role="status" data-testid="waste-loading">{tr('بنبص على الصورة…', 'Looking at the photo…')}</span> : null}
      {suggestion.state === 'ready' ? (
        <div className="cc-suggest" data-testid="waste-suggestion">
          <div className="cc-suggest-head"><Icon name="sparkles" size={16} /><b>{tr('اقتراح من الصورة', 'Suggested from the photo')}</b></div>
          <div className="cc-suggest-chips" role="group" aria-label={tr('اقتراح من الصورة', 'Suggested from the photo')}>
            {suggestion.value.materials.map((m) => {
              const on = selected.has(m.materialId);
              return (
                <button
                  key={m.materialId}
                  type="button"
                  className={`ftc-filter${on ? ' is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => onAccept(m.materialId, suggestion.value)}
                  data-testid={`suggest-${m.materialId}`}
                >
                  {on ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
                  {`${materialLabel(m.materialId)} · ${localDigits(Math.round(m.confidence * 100))}${tr('٪', '%')}`}
                </button>
              );
            })}
          </div>
          <span className="ftc-help">{tr('ده اقتراح بس: اختار اللي صح وغيّر الوزن.', 'This is only a suggestion: choose what is right and adjust the weight.')}</span>
        </div>
      ) : null}
    </>
  );
}

/** Gold estimate card for "sell it": about X EGP, or "price to be set". */
export function EstimateCard({ valueEgp, unpriced }: { valueEgp: number | undefined; unpriced: MaterialId[] }) {
  const tr = useTr();
  return (
    <div className="cc-estimate" data-testid="recycling-estimate">
      <Icon name="coins" size={20} />
      <div className="w-grow">
        <b>{valueEgp !== undefined ? `${tr('تقريبًا', 'About')} ${formatEgp(valueEgp)}` : tr('السعر هيتحدد', 'Price to be set')}</b>
        <span className="ftc-help">
          {unpriced.length > 0 && valueEgp !== undefined
            ? tr(`من غير ${unpriced.map(materialLabel).join('، ')} (لسه من غير سعر). الوزن الفعلي هو اللي بيحدد.`, `Not counting ${unpriced.map(materialLabel).join(', ')} (no price yet). The actual weight decides.`)
            : tr('الوزن الفعلي هو اللي بيحدد المبلغ.', 'The actual weight decides the amount.')}
        </span>
      </div>
    </div>
  );
}

