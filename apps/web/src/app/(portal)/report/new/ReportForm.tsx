'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, getCategory } from '@/domain/categories';
import type { CategoryId, TriageSuggestion } from '@/domain/types';
import { validateReportForm, type ReportFormErrors } from '@/components/report/validation';
import { pickDuplicateView } from '@/logic/duplicates';
import { useAreaCenter } from '@/lib/area';
import { useReportLocation } from '@/lib/location';
import { compressImage } from '@/lib/photo';
import { API_MODE, services } from '@/services';
import { useReports, useSession } from '@/store';
import { isQueuedOnDevice } from '@/store/outboxTabs';
import { useOutbox } from '@/store/useOutbox';
import { toArabicDigits } from '@/utils/digits';
import { CategoryPicker } from '@/ui/CategoryGrid';
import { ToggleRow } from '@/ui/controls';
import { QueuedNotice } from '@/ui/QueuedNotice';
import { Icon } from '@/ui/Icon';
import { AiSuggestion, AlreadyReportedNote, CategoryRow, DuplicatePanel, LocationCard, PhotoSlots, VoiceRow, type TriageState } from './parts';

const isCategoryId = (v: string | null): v is CategoryId => !!v && CATEGORIES.some((c) => c.id === v);

/** Same flow and rules as apps/mobile/src/app/report/new.tsx, laid out as the web mockup (form + sticky summary). */
export function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const paramCategory = isCategoryId(params.get('category')) ? (params.get('category') as CategoryId) : null;

  const userId = useSession((s) => s.userId);
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const dataSaver = useSession((s) => s.prefs.dataSaver);

  const center = useAreaCenter();
  const { place, state: locState, locate, setAddress, setLandmark, setPoint } = useReportLocation(center);

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | undefined>();
  const addSpokenText = useCallback((text: string) => {
    setDescription((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text));
    setErrors((e) => ({ ...e, description: undefined }));
  }, []);
  const [blurFaces, setBlurFaces] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [manualCategory, setManualCategory] = useState<CategoryId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [done, setDone] = useState<{ key: string; suggestion: TriageSuggestion | null } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [dismissedDup, setDismissedDup] = useState<string | null>(null);

  const [errors, setErrors] = useState<ReportFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'send' | 'join' | null>(null);
  const [queuedId, setQueuedId] = useState<string | null>(null);

  const trimmed = description.trim();
  const hasInput = photos.length > 0 || trimmed.length >= 5;
  const priorCategory = manualCategory ?? paramCategory;
  const mainPhoto = photos[0];

  // Mock AI: runs once there is a photo or a few words; debounced while typing; stale answers are dropped.
  // `done.key` says which inputs the latest answer belongs to, so "loading" is derived rather than stored.
  const inputKey = [trimmed, mainPhoto ? mainPhoto.length : '', priorCategory ?? '', place.lat, place.lng, retryTick].join('|');
  const triage = hasInput ? (done?.suggestion ?? null) : null;
  const triageState: TriageState = !hasInput ? 'idle' : done?.key !== inputKey ? 'loading' : done.suggestion ? 'ready' : 'error';
  const categoryId: CategoryId | null = manualCategory ?? triage?.options[0]?.categoryId ?? paramCategory;

  useEffect(() => {
    if (!hasInput) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let suggestion: TriageSuggestion | null = null;
      try {
        suggestion = await services.triage.analyze({
          userId: userId ?? '',
          description: trimmed,
          categoryId: priorCategory ?? undefined,
          // The backend can't open a browser data URL: the photo goes to /triage only once it's uploaded.
          photoUri: API_MODE === 'mock' ? mainPhoto : undefined,
          location: { lat: place.lat, lng: place.lng },
        });
      } catch {
        suggestion = null;
      }
      if (!cancelled) setDone({ key: inputKey, suggestion });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hasInput, inputKey, userId, trimmed, mainPhoto, priorCategory, place.lat, place.lng]);

  // Only matches of the category that will be submitted count (the AI top pick may differ from a manual pick).
  const dupView = pickDuplicateView(triage, categoryId);
  const duplicate = dupView.kind === 'join' && dupView.match.incidentId !== dismissedDup ? dupView.match : null;

  const addPhotos = async (files: File[]) => {
    const room = 2 - photos.length;
    const images = files.filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (files.length && !images.length) {
      setPhotoError('الملف ده مش صورة. اختار صورة من جهازك.');
      return;
    }
    if (!images.length) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const encoded = await Promise.all(images.map((f) => compressImage(f, dataSaver)));
      setPhotos((p) => [...p, ...encoded].slice(0, 2));
      setErrors((e) => ({ ...e, description: undefined }));
    } catch {
      setPhotoError('مقدرناش نفتح الصورة دي. جرّب صورة تانية، أو كمّل بوصف المشكلة.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = useCallback(
    async (linkTo?: string) => {
      if (submitting) return;
      const values = {
        categoryId: categoryId ?? '',
        description: trimmed,
        photoUris: photos,
        location: { lat: place.lat, lng: place.lng, address: place.address.trim(), landmark: place.landmark?.trim() || undefined },
        anonymous,
        blurFaces,
      };
      const found = validateReportForm(values);
      setErrors(found);
      setSubmitError(null);
      if (Object.keys(found).length > 0) return;

      setSubmitting(linkTo ? 'join' : 'send');
      const input = {
        categoryId: values.categoryId as CategoryId,
        description: values.description,
        photoUris: photos,
        location: values.location,
        anonymous,
        blurFaces,
        severity: triage?.severity,
        governorate,
        district,
        linkToIncidentId: linkTo,
        voiceNoteUri,
      };
      try {
        // Uploads the photos and the voice note, then sends. With no connection (or an unreachable server) the
        // shared store keeps the report in its outbox and says so: show the "saved" notice in place.
        const res = await useReports.getState().submitReport(input);
        if (res.queued) {
          // A full disk drops the write: never say "saved on your device" when it is not.
          if (!isQueuedOnDevice(res.item.id)) {
            useOutbox.getState().remove(res.item.id);
            setSubmitError('مفيش مساحة نحفظ البلاغ على جهازك. جرّب تبعته لما النت يرجع.');
            setSubmitting(null);
            return;
          }
          setQueuedId(res.item.id);
          return;
        }
        router.replace('/report/success');
      } catch (e) {
        setSubmitError(e instanceof Error && e.message && !(e instanceof TypeError) ? e.message : 'معرفناش نبعت البلاغ، جرّب تاني.');
        setSubmitting(null);
      }
    },
    [submitting, categoryId, trimmed, photos, place, anonymous, blurFaces, triage, governorate, district, router, voiceNoteUri],
  );

  const pickCategory = (id: CategoryId) => {
    setManualCategory(id);
    setPickerOpen(false);
    setErrors((e) => ({ ...e, categoryId: undefined }));
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const cat = categoryId ? getCategory(categoryId) : null;
  const summary = useMemo(
    () => [
      { k: 'النوع', v: cat?.labelAr ?? 'لسه مش متحدد' },
      { k: 'المكان', v: place.address || 'لسه مش مكتوب' },
      { k: 'الجهة', v: cat ? `${cat.department} · حي ${district}` : '—' },
      { k: 'الصور', v: photos.length ? `${toArabicDigits(photos.length)} ${photos.length === 1 ? 'صورة' : 'صور'}` : 'من غير صور' },
      { k: 'الخصوصية', v: [blurFaces ? 'الوشوش والنمر متغطية' : 'الصور زي ما هي', anonymous ? 'من غير اسم' : null].filter(Boolean).join(' · ') },
    ],
    [cat, place.address, district, photos.length, blurFaces, anonymous],
  );

  if (queuedId) return <QueuedNotice id={queuedId} />;

  return (
    <main className="ftc-web-main" id="main">
      <Link className="w-back" href="/report/category"><Icon name="arrow-back" size={18} />نوع المشكلة</Link>
      <div className="w-page-head">
        <div><h1 className="w-h1">بلاغ جديد</h1><p className="w-sub">صوّر المشكلة وقولنا مكانها، والباقي علينا.</p></div>
        <span className="w-step">خطوة ٢ من ٣</span>
      </div>
      <div className="w-stepbar" aria-hidden="true"><span className="on" /><span className="on" /><span /></div>
      <div className="r-grid">
        <form
          className="r-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <section className="ftc-card r-sec" aria-labelledby="h-ph">
            <h2 className="w-h3" id="h-ph"><Icon name="camera" size={20} />الصور</h2>
            <PhotoSlots photos={photos} busy={photoBusy} error={photoError} onAdd={(f) => void addPhotos(f)} onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} />
          </section>

          <section className="r-sec" aria-label="التصنيف">
            {triageState === 'idle' ? (
              <CategoryRow selected={categoryId} onPress={() => setPickerOpen(true)} />
            ) : (
              <AiSuggestion state={triageState} suggestion={triage} selected={categoryId} onSelect={pickCategory} onPickOther={() => setPickerOpen(true)} onRetry={() => setRetryTick((n) => n + 1)} />
            )}
            {errors.categoryId ? <span className="a-err" role="alert">{errors.categoryId}</span> : null}
          </section>

          <section className="ftc-card r-sec" aria-labelledby="h-desc">
            <h2 className="w-h3" id="h-desc">وصف المشكلة</h2>
            <VoiceRow highlight={params.get('voice') === '1'} onText={addSpokenText} onVoiceNote={setVoiceNoteUri} />
            <div className="ftc-field">
              <label className="w-sr" htmlFor="desc">وصف المشكلة</label>
              <textarea
                className="ftc-textarea"
                id="desc"
                data-testid="description-input"
                rows={4}
                placeholder="اكتب المشكلة بالعامية، زي: فيه حفرة قدام المدرسة"
                value={description}
                aria-invalid={!!errors.description}
                aria-describedby="desc-help"
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors((er) => ({ ...er, description: undefined }));
                }}
              />
              {errors.description ? <span className="a-err" role="alert" id="desc-help">{errors.description}</span> : <span className="ftc-help" id="desc-help">لو مفيش صورة، اكتب ١٠ حروف على الأقل.</span>}
            </div>
          </section>

          <section className="ftc-card r-sec" aria-labelledby="h-loc">
            <h2 className="w-h3" id="h-loc">المكان</h2>
            <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onLocate={() => void locate()} onMove={setPoint} />
            <div className="ftc-field">
              <label className="ftc-label" htmlFor="lm">علامة مميزة (اختياري)</label>
              <input className="ftc-input" id="lm" data-testid="landmark-input" type="text" placeholder="مثلًا: قدام مدرسة النصر الإعدادية" value={place.landmark ?? ''} onChange={(e) => setLandmark(e.target.value)} />
            </div>
          </section>

          <section className="ftc-card r-sec" aria-labelledby="h-priv">
            <h2 className="w-h3" id="h-priv">خصوصيتك</h2>
            <ToggleRow icon="eye-off" title="اخفي الوشوش ونمر العربيات" subtitle="بنعمل blur تلقائي قبل ما الصورة تتنشر" on={blurFaces} onChange={setBlurFaces} testId="toggle-blur" />
            <ToggleRow icon="shield-check" title="بلّغ من غير اسم" subtitle="الحي مش هيشوف اسمك ولا رقمك" on={anonymous} onChange={setAnonymous} testId="toggle-anonymous" />
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>

        <aside className="r-side" aria-label="ملخص البلاغ">
          <div className="ftc-card r-sum">
            <h2 className="w-h3" style={{ marginBottom: 12 }}>ملخص البلاغ</h2>
            <dl>
              {summary.map((r) => (
                <div key={r.k} style={{ display: 'contents' }}><dt>{r.k}</dt><dd>{r.v}</dd></div>
              ))}
            </dl>
          </div>
          {dupView.kind === 'own' ? <AlreadyReportedNote own={dupView.own} /> : null}
          {duplicate ? <DuplicatePanel match={duplicate} busy={submitting === 'join'} onJoin={() => void submit(duplicate.incidentId)} onDismiss={() => setDismissedDup(duplicate.incidentId)} /> : null}
          <div className="r-send">
            {submitError ? <span className="a-err" role="alert" style={{ textAlign: 'center' }}>{submitError}</span> : null}
            {!submitError && errorCount > 0 ? <span className="a-err" role="alert" style={{ textAlign: 'center' }}>راجع الحقول اللي متعلّمة بالأحمر.</span> : null}
            <span className="off"><Icon name="wifi" size={14} />النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع</span>
            <button className="ftc-btn ftc-btn--primary" type="button" disabled={!!submitting || photoBusy} onClick={() => void submit()} data-testid="submit-report">
              {submitting === 'send' ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}ابعت البلاغ <Icon name="arrow-forward" size={20} strokeWidth={2} />
            </button>
          </div>
        </aside>
      </div>
      <CategoryPicker open={pickerOpen} selected={categoryId} onClose={() => setPickerOpen(false)} onSelect={pickCategory} />
    </main>
  );
}
