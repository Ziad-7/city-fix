'use client';

/* eslint-disable @next/next/no-img-element -- local photo preview (data URL) */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { validateTreeBooking, type TreeFormErrors } from '@/components/services/tree';
import { slotLabel } from '@/components/requests/labels';
import { dayLabel } from '@/components/services/day';
import { FREE_SERVICE_LABEL, SLOTS, TREE_WORK_TYPES, nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { FREE_SERVICE_LABEL_EN, itemLabel, slotLabel as slotLabelFor, useTr } from '@/i18n';
import { useAreaCenter } from '@/lib/area';
import { useReportLocation } from '@/lib/location';
import { compressImage } from '@/lib/photo';
import { usePageTitle } from '@/lib/usePageTitle';
import { services } from '@/services';
import { PHOTO_CONTENT_TYPE } from '@/services/media';
import { useServiceRequests, useSession } from '@/store';
import { ChoiceGroup } from '@/ui/controls';
import { DayPicker } from '@/ui/DayPicker';
import { Icon } from '@/ui/Icon';
import { LocationCard } from '../../report/new/parts';

/** Tree trimming or removal (free, from the district gardens department): same rules as apps/mobile/src/app/services/tree.tsx. */
export default function TreeMaintenancePage() {
  const tr = useTr();
  usePageTitle(tr('تقليم أو إزالة شجرة', 'Tree trimming or removal'));
  const router = useRouter();
  const dataSaver = useSession((s) => s.prefs.dataSaver);
  const bookService = useServiceRequests((s) => s.bookService);

  const center = useAreaCenter();
  const { place, state: locState, locate, setAddress, setLandmark, setPoint } = useReportLocation(center);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [workType, setWorkType] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<TreeFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ local: string; path: string } | null>(null);

  const addPhoto = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith('image/'));
    if (!file) {
      if (files.length) setPhotoProblem(tr('الملف ده مش صورة. اختار صورة من جهازك.', 'That file isn’t a photo. Pick a photo from your device.'));
      return;
    }
    setPhotoBusy(true);
    setPhotoProblem(null);
    try {
      setPhoto(await compressImage(file, dataSaver));
    } catch {
      setPhotoProblem(tr('مقدرناش نفتح الصورة دي. جرّب صورة تانية، أو كمّل من غير صورة.', 'We couldn’t open that photo. Try another one, or continue without a photo.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    const { errors: next, input } = validateTreeBooking({ workType, day, slot, note, place, photoUris: photo ? [photo] : [] });
    setErrors(next);
    setSubmitError(null);
    if (!input) return;
    setBusy(true);
    try {
      if (photo && input.details.photoUris) {
        // Same pipeline as report photos: a 1600 px JPEG, uploaded once (a retry after a failed booking reuses it).
        if (uploaded.current?.local !== photo) {
          const path = await services.uploads.upload(photo, 'report_photo', PHOTO_CONTENT_TYPE);
          uploaded.current = { local: photo, path };
        }
        input.details.photoUris = [uploaded.current.path];
      }
      const req = await bookService(input);
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error && e.message ? e.message : tr('معرفناش نحجز الميعاد، جرّب تاني', 'We couldn’t book your slot. Please try again.'));
      setBusy(false);
    }
  };

  const address = [place.address, place.landmark].filter(Boolean).join(' · ');

  return (
    <main className="ftc-web-main" id="main">
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />{tr('خدمات المدينة', 'City services')}</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div><h1 className="w-h1">{tr('تقليم أو إزالة شجرة', 'Tree trimming or removal')}</h1><p className="w-sub">{tr('إدارة الحدائق بتبعت فريق خلال ٥ أيام من الميعاد المختار.', 'The Parks Department sends a team within 5 days of your chosen day.')}</p></div>
      </div>
      <div className="v-book">
        <form className="v-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <section className="ftc-card v-sec" aria-labelledby="t1">
            <header><h2 className="w-h3" id="t1">{tr('الشغل المطلوب', 'Work needed')}</h2><span>{tr('اختار واحد', 'Choose one')}</span></header>
            <ChoiceGroup
              className="v-items"
              label={tr('الشغل المطلوب', 'Work needed')}
              options={TREE_WORK_TYPES.map((w) => ({ id: w, label: itemLabel(w) }))}
              value={workType || null}
              onChange={(v) => { setWorkType(v); setErrors((e) => ({ ...e, workType: undefined })); }}
              testIdPrefix="work"
            />
            {errors.workType ? <span className="a-err" role="alert">{errors.workType}</span> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="t2">
            <header><h2 className="w-h3" id="t2">{tr('صورة الشجرة', 'Photo of the tree')}</h2><span>{tr('اختياري', 'Optional')}</span></header>
            {photo ? (
              <div className="r-photos">
                <div className="r-ph">
                  <img src={photo} alt={tr('صورة الشجرة', 'Photo of the tree')} />
                  <button className="rm" type="button" aria-label={tr('امسح الصورة', 'Remove photo')} onClick={() => setPhoto(null)}><Icon name="x" size={16} strokeWidth={2} /></button>
                </div>
              </div>
            ) : (
              <div className="v-pair">
                {/* Camera: opens the phone camera. Gallery: no `capture`, so a photo that was already taken can be picked. */}
                <label className="ftc-btn ftc-btn--secondary" htmlFor="tree-camera">{photoBusy ? <span className="a-spin" aria-hidden="true" /> : <Icon name="camera" size={20} />}{tr('صوّر', 'Take a photo')}</label>
                <label className="ftc-btn ftc-btn--secondary" htmlFor="tree-gallery"><Icon name="image" size={20} />{tr('من المعرض', 'From gallery')}</label>
                <input id="tree-camera" data-testid="tree-photo-camera" className="w-sr" type="file" accept="image/*" capture="environment" onChange={(e) => { void addPhoto(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                <input id="tree-gallery" data-testid="tree-photo-gallery" className="w-sr" type="file" accept="image/*" onChange={(e) => { void addPhoto(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
              </div>
            )}
            {photoProblem ? <span className="a-err" role="alert">{photoProblem}</span> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="t3">
            <h2 className="w-h3" id="t3">{tr('المكان', 'Location')}</h2>
            <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onLocate={() => void locate()} onMove={setPoint} />
            <div className="ftc-field">
              <label className="ftc-label" htmlFor="tree-lmk">{tr('علامة مميزة (اختياري)', 'Landmark (optional)')}</label>
              <input className="ftc-input" id="tree-lmk" data-testid="landmark-input" placeholder={tr('مثلًا: قدام الجنينة جنب المدرسة', 'e.g. In front of the park, next to the school')} value={place.landmark ?? ''} onChange={(e) => setLandmark(e.target.value)} />
            </div>
          </section>

          <section className="ftc-card v-sec" aria-labelledby="t4">
            <header><h2 className="w-h3" id="t4">{tr('اختار الميعاد', 'Pick a time')}</h2><span>{tr('الخدمة من الأحد للخميس', 'Available Sunday to Thursday')}</span></header>
            <DayPicker days={days} value={day} onChange={setDay} columns={3} />
            <div className="ftc-field">
              <span className="ftc-label" id="tsl">{tr('الفترة', 'Time slot')}</span>
              <ChoiceGroup className="v-pair" labelledBy="tsl" options={SLOTS.map((s) => ({ id: s.id, label: slotLabelFor(s) }))} value={slot} onChange={setSlot} testIdPrefix="slot" />
            </div>
            {errors.day ? <span className="a-err" role="alert">{errors.day}</span> : null}
          </section>

          <section className="ftc-card v-sec" aria-labelledby="t5">
            <header><h2 className="w-h3" id="t5">{tr('ملاحظة', 'Note')}</h2><span>{tr('اختياري', 'Optional')}</span></header>
            <label className="w-sr" htmlFor="tree-note">{tr('ملاحظة', 'Note')}</label>
            <textarea className="ftc-textarea" id="tree-note" data-testid="tree-note" rows={3} placeholder={tr('مثلًا: الفرع قريب من أسلاك الكهربا', 'e.g. The branch is close to power lines')} value={note} onChange={(e) => setNote(e.target.value)} />
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>

        <aside className="v-sum" aria-label={tr('ملخص الحجز', 'Booking summary')}>
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 14 }}>{tr('ملخص الحجز', 'Booking summary')}</h2>
            <dl>
              <dt>{tr('الخدمة', 'Service')}</dt><dd>{tr('تقليم أو إزالة شجرة', 'Tree trimming or removal')}</dd>
              <dt>{tr('الشغل', 'Work')}</dt><dd>{workType ? itemLabel(workType) : tr('لسه مفيش', 'Nothing yet')}</dd>
              <dt>{tr('اليوم', 'Day')}</dt><dd>{dayLabel(day)}</dd>
              <dt>{tr('الفترة', 'Time slot')}</dt><dd>{slotLabel(slot)}</dd>
              <dt>{tr('الرسوم', 'Fee')}</dt><dd>{tr(FREE_SERVICE_LABEL, FREE_SERVICE_LABEL_EN)}</dd>
              <dt>{tr('العنوان', 'Address')}</dt><dd>{address || tr('لسه مش مكتوب', 'Not entered yet')}</dd>
            </dl>
          </div>
          <div className="ftc-notice" data-testid="tree-free"><Icon name="check" size={20} className="w-notice-ic" /><span>{tr(`${FREE_SERVICE_LABEL}، من غير أي رسوم.`, `${FREE_SERVICE_LABEL_EN}, with no fees.`)}</span></div>
          {submitError ? <span className="a-err" role="alert">{submitError}</span> : null}
          <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="button" disabled={busy || photoBusy} onClick={() => void submit()} data-testid="tree-submit">
            {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('احجز الميعاد', 'Book a slot')}
          </button>
        </aside>
      </div>
    </main>
  );
}
