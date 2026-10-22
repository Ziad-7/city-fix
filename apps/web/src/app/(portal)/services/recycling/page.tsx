'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_KG,
  MATERIAL_IDS,
  PICKUP_MODES,
  WASTE_SIZE_KG,
  estimateValue,
  formatKg,
  pickupModeLabel,
  materialLabel,
  sumKg,
  validatePickupInput,
  type MaterialId,
  type PickupFormErrors,
  type PickupMode,
  type WasteClassification,
} from '@/domain/citycycle';
import { SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { dayLabel } from '@/components/services/day';
import { slotLabel, useTr } from '@/i18n';
import { useAreaCenter } from '@/lib/area';
import { useReportLocation } from '@/lib/location';
import { compressImage } from '@/lib/photo';
import { usePageTitle } from '@/lib/usePageTitle';
import { services } from '@/services';
import { PHOTO_CONTENT_TYPE } from '@/services/media';
import { useRecycling, useSession } from '@/store';
import { DemoPricesNote, MaterialGrid } from '@/ui/citycycle';
import { ChoiceGroup } from '@/ui/controls';
import { DayPicker } from '@/ui/DayPicker';
import { Icon } from '@/ui/Icon';
import { LocationCard, VoiceRow } from '../../report/new/parts';
import { EstimateCard, PhotoBlock, WeightRows, type Suggestion } from './parts';

/** CityCycle: ask for a recyclables pickup (same rules as apps/mobile/src/app/services/recycling.tsx). */
export default function RecyclingPickupPage() {
  const tr = useTr();
  usePageTitle(tr('جمع تدوير من بيتك', 'Recycling pickup'));
  const router = useRouter();
  const dataSaver = useSession((s) => s.prefs.dataSaver);
  const prices = useRecycling((s) => s.prices);
  const loadPrices = useRecycling((s) => s.loadPrices);
  const createPickup = useRecycling((s) => s.createPickup);

  const center = useAreaCenter();
  const { place, state: locState, locate, setAddress, setLandmark, setPoint } = useReportLocation(center);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [kgById, setKgById] = useState<Partial<Record<MaterialId, number>>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion>({ state: 'none' });
  const [mode, setMode] = useState<PickupMode>('paid');
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<PickupFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ local: string; path: string } | null>(null);
  const photoTicket = useRef(0);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const selected = useMemo(() => new Set(Object.keys(kgById) as MaterialId[]), [kgById]);
  const items = useMemo(() => MATERIAL_IDS.filter((id) => kgById[id] !== undefined).map((id) => ({ materialId: id, estimatedKg: kgById[id] as number })), [kgById]);
  const estimate = useMemo(() => estimateValue(items, prices), [items, prices]);

  const toggle = (id: MaterialId) => {
    setErrors((e) => ({ ...e, items: undefined, kg: undefined }));
    setKgById((cur) => {
      const next = { ...cur };
      if (next[id] !== undefined) delete next[id];
      else next[id] = DEFAULT_KG;
      return next;
    });
  };

  /** Upload once (a retry after a failed request reuses the path). Returns the path to send. */
  const uploadPhoto = useCallback(async (local: string): Promise<string> => {
    if (uploaded.current?.local === local) return uploaded.current.path;
    const path = await services.uploads.upload(local, 'report_photo', PHOTO_CONTENT_TYPE);
    uploaded.current = { local, path };
    return path;
  }, []);

  const addPhoto = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith('image/'));
    if (!file) {
      if (files.length) setPhotoProblem(tr('الملف ده مش صورة. اختار صورة من جهازك.', 'That file isn’t a photo. Pick a photo from your device.'));
      return;
    }
    setPhotoBusy(true);
    setPhotoProblem(null);
    let uri: string;
    try {
      uri = await compressImage(file, dataSaver);
    } catch {
      setPhotoProblem(tr('مقدرناش نفتح الصورة دي. جرّب صورة تانية، أو كمّل من غير صورة.', 'We couldn’t open that photo. Try another one, or continue without a photo.'));
      setPhotoBusy(false);
      return;
    }
    setPhotoBusy(false);
    setPhoto(uri);
    // The AI check is a suggestion only: any failure just means no suggestion.
    const ticket = ++photoTicket.current;
    setSuggestion({ state: 'loading' });
    try {
      const path = await uploadPhoto(uri);
      const value = await services.waste.classify(path);
      if (ticket === photoTicket.current) setSuggestion(value.materials.length > 0 ? { state: 'ready', value } : { state: 'none' });
    } catch {
      if (ticket === photoTicket.current) setSuggestion({ state: 'none' });
    }
  };
  const removePhoto = () => {
    photoTicket.current += 1;
    setPhoto(null);
    setSuggestion({ state: 'none' });
  };

  const acceptSuggestion = (id: MaterialId, value: WasteClassification) => {
    setErrors((e) => ({ ...e, items: undefined, kg: undefined }));
    const mid = value.estimatedKgRange ? (value.estimatedKgRange[0] + value.estimatedKgRange[1]) / 2 : WASTE_SIZE_KG[value.size];
    setKgById((cur) => (cur[id] !== undefined ? cur : { ...cur, [id]: Math.max(0.5, Math.round(mid * 2) / 2) }));
  };

  const addSpokenText = useCallback((text: string) => setNote((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text)), []);
  const ignoreVoicePath = useCallback(() => undefined, []);

  const submit = async () => {
    if (busy) return;
    const location = { ...place, address: place.address.trim(), landmark: place.landmark?.trim() || undefined };
    const errs = validatePickupInput({ items, location, day });
    setErrors(errs);
    setSubmitError(null);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      const photoUris = photo ? [await uploadPhoto(photo)] : [];
      const p = await createPickup({ items, photoUris, location, day, slot, mode, note: note.trim() || undefined });
      router.replace(`/requests/${p.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error && e.message ? e.message : tr('معرفناش نبعت الطلب، جرّب تاني', 'We couldn’t send your request. Please try again.'));
      setBusy(false);
    }
  };

  const itemsError = errors.items ?? errors.kg;
  const address = [place.address, place.landmark].filter(Boolean).join(' · ');

  return (
    <main className="ftc-web-main" id="main">
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />{tr('خدمات المدينة', 'City services')}</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="w-h1">{tr('جمع تدوير من بيتك', 'Recycling pickup')}</h1>
          <p className="w-sub">{tr('جامع موثّق من الحي بيعدّي ياخد الخامات من عندك ويوزنها قدامك.', 'A collector verified by the district comes to your door and weighs the materials in front of you.')}</p>
        </div>
      </div>
      <div className="v-book">
        <form className="v-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <section className="ftc-card v-sec" aria-labelledby="c1">
            <h2 className="w-h3" id="c1">{tr('عندك إيه؟', 'What do you have?')}</h2>
            <MaterialGrid materials={MATERIAL_IDS} selected={selected} prices={prices} onToggle={toggle} />
            <DemoPricesNote />
            {itemsError ? <span className="a-err" role="alert" data-testid="items-error">{itemsError}</span> : null}
            <Link className="ftc-btn ftc-btn--ghost ftc-btn--sm cc-guide-link" href="/recycling-guide" data-testid="open-guide"><Icon name="info" size={18} />{tr('دليل الفرز بالصور', 'Sorting guide with pictures')}</Link>
          </section>

          {items.length > 0 ? (
            <section className="ftc-card v-sec" aria-labelledby="c2">
              <header><h2 className="w-h3" id="c2">{tr('الوزن التقريبي', 'Rough weight')}</h2><span>{tr('تقدير بس. الجامع بيوزن بالميزان.', 'Just an estimate. The collector weighs it on a scale.')}</span></header>
              <WeightRows items={items} onChange={(id, kg) => setKgById((cur) => ({ ...cur, [id]: kg }))} />
            </section>
          ) : null}

          <section className="ftc-card v-sec" aria-labelledby="c3">
            <header><h2 className="w-h3" id="c3">{tr('صورة (اختياري)', 'Photo (optional)')}</h2><span>{tr('بنقترح الخامة من الصورة والقرار في إيدك.', 'We suggest the material from the photo, and you confirm.')}</span></header>
            <PhotoBlock photo={photo} busy={photoBusy} problem={photoProblem} suggestion={suggestion} selected={selected} onFiles={(f) => void addPhoto(f)} onRemove={removePhoto} onAccept={acceptSuggestion} />
          </section>

          <section className="ftc-card v-sec" aria-labelledby="c4">
            <h2 className="w-h3" id="c4">{tr('بتدّيها ولا بتبيعها؟', 'Give it away or sell it?')}</h2>
            <ChoiceGroup
              className="cc-mode"
              labelledBy="c4"
              options={PICKUP_MODES.map((m) => ({
                id: m.id,
                ariaLabel: `${tr(m.ar, m.en)}, ${tr(m.subAr, m.subEn)}`,
                label: <span className="cc-mode-text"><span>{tr(m.ar, m.en)}</span><small>{tr(m.subAr, m.subEn)}</small></span>,
              }))}
              value={mode}
              onChange={setMode}
              testIdPrefix="mode"
            />
            {mode === 'paid' && items.length > 0 ? <EstimateCard valueEgp={estimate.valueEgp} unpriced={estimate.unpriced} /> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="c5">
            <h2 className="w-h3" id="c5">{tr('المكان', 'Location')}</h2>
            <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onLocate={() => void locate()} onMove={setPoint} />
            <div className="ftc-field">
              <label className="ftc-label" htmlFor="rcy-lmk">{tr('علامة مميزة (اختياري)', 'Landmark (optional)')}</label>
              <input className="ftc-input" id="rcy-lmk" data-testid="landmark-input" placeholder={tr('مثلًا: جنب الصيدلية، الدور التالت', 'e.g. Next to the pharmacy, third floor')} value={place.landmark ?? ''} onChange={(e) => setLandmark(e.target.value)} />
            </div>
          </section>

          <section className="ftc-card v-sec" aria-labelledby="c6">
            <header><h2 className="w-h3" id="c6">{tr('اختار الميعاد', 'Pick a time')}</h2><span>{tr('من الأحد للخميس', 'Sunday to Thursday')}</span></header>
            <DayPicker days={days} value={day} onChange={setDay} columns={3} />
            <div className="ftc-field">
              <span className="ftc-label" id="rcy-sl">{tr('الفترة', 'Time slot')}</span>
              <ChoiceGroup className="v-pair" labelledBy="rcy-sl" options={SLOTS.map((s) => ({ id: s.id, label: slotLabel(s) }))} value={slot} onChange={setSlot} testIdPrefix="slot" />
            </div>
            {errors.day ? <span className="a-err" role="alert">{errors.day}</span> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="c7">
            <header><h2 className="w-h3" id="c7">{tr('ملاحظة (اختياري)', 'Note (optional)')}</h2></header>
            <VoiceRow onText={addSpokenText} onVoiceNote={ignoreVoicePath} />
            <label className="w-sr" htmlFor="recycling-note">{tr('ملاحظة (اختياري)', 'Note (optional)')}</label>
            <textarea className="ftc-textarea" id="recycling-note" data-testid="recycling-note" rows={3} placeholder={tr('مثلًا: الخامات في الجراج، رن الجرس', 'e.g. The materials are in the garage, ring the bell')} value={note} onChange={(e) => setNote(e.target.value)} />
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>

        <aside className="v-sum" aria-label={tr('ملخص الطلب', 'Request summary')}>
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 14 }}>{tr('ملخص الطلب', 'Request summary')}</h2>
            <dl>
              <dt>{tr('الخامات', 'Materials')}</dt><dd>{items.length ? items.map((i) => materialLabel(i.materialId)).join(tr('، ', ', ')) : tr('لسه مفيش', 'Nothing yet')}</dd>
              <dt>{tr('الوزن التقريبي', 'Rough weight')}</dt><dd>{items.length ? formatKg(sumKg(items)) : tr('لسه مفيش', 'Nothing yet')}</dd>
              <dt>{tr('بتدّيها ولا بتبيعها؟', 'Give it away or sell it?')}</dt><dd>{pickupModeLabel(mode)}</dd>
              <dt>{tr('اليوم', 'Day')}</dt><dd>{dayLabel(day)}</dd>
              <dt>{tr('الفترة', 'Time slot')}</dt><dd>{slotLabel(SLOTS.find((s) => s.id === slot) ?? SLOTS[0])}</dd>
              <dt>{tr('العنوان', 'Address')}</dt><dd>{address || tr('لسه مش مكتوب', 'Not entered yet')}</dd>
            </dl>
          </div>
          {submitError ? <span className="a-err" role="alert" data-testid="recycling-error">{submitError}</span> : null}
          <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="button" disabled={busy || photoBusy} onClick={() => void submit()} data-testid="recycling-submit">
            {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('ابعت الطلب', 'Send the request')}
          </button>
        </aside>
      </div>
    </main>
  );
}
