'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import { bulkyBookingSchema, placeSchema } from '@/domain/schemas';
import { BULKY_ITEMS, FEE_LABEL, PAYMENT_METHODS, SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import type { PaymentMethod, SlotId } from '@/domain/types';
import { dayLabel } from '@/components/services/day';
import { paymentLabel, slotLabel } from '@/components/requests/labels';
import { FEE_LABEL_EN, itemLabel, paymentLabelFor, placeName, slotLabel as slotLabelFor, useTr } from '@/i18n';
import { useServiceRequests, useSession } from '@/store';
import { ChoiceGroup } from '@/ui/controls';
import { DayPicker } from '@/ui/DayPicker';
import { Icon } from '@/ui/Icon';
import { usePageTitle } from '@/lib/usePageTitle';

type Errors = Partial<Record<'items' | 'day' | 'address', string>>;

/** Bulky-waste pickup booking (same rules as apps/mobile/src/app/services/bulky-waste.tsx). */
export default function BulkyWastePage() {
  const tr = useTr();
  usePageTitle(tr('رفع مخلفات كبيرة', 'Bulky waste pickup'));
  const router = useRouter();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const bookService = useServiceRequests((s) => s.bookService);

  const days = useMemo(() => nextWorkingDays(5), []);
  const [items, setItems] = useState<string[]>([]);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [address, setAddress] = useState(`${placeName(district)}${tr('، ', ', ')}${placeName(governorate)}`);
  const [landmark, setLandmark] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Errors = {};
    const parsed = bulkyBookingSchema.safeParse({ items, day, slot, payment });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'items' ? 'items' : 'day';
        next[key] ??= key === 'items' ? tr('اختار حاجة واحدة على الأقل', 'Choose at least one item') : tr('اختار اليوم', 'Choose a day');
      }
    }
    const center = findDistrict(governorate, district) ?? DEFAULT_PLACE;
    const place = placeSchema.safeParse({ lat: center.lat, lng: center.lng, address: address.trim(), landmark: landmark.trim() || undefined });
    if (!place.success) next.address = tr('اكتب العنوان', 'Enter the address');
    setErrors(next);
    setSubmitError(null);
    if (!parsed.success || !place.success) return;

    setBusy(true);
    try {
      const req = await bookService({ serviceType: 'bulky_waste', details: parsed.data, location: place.data });
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tr('معرفناش نحجز الميعاد، جرّب تاني', 'We couldn’t book your slot. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <main className="ftc-web-main" id="main">
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />{tr('خدمات المدينة', 'City services')}</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div><h1 className="w-h1">{tr('رفع مخلفات كبيرة', 'Bulky waste pickup')}</h1><p className="w-sub">{tr('عفش قديم، أجهزة، مخلفات بناء · بنوصلك خلال ٤٨ ساعة من الميعاد.', 'Old furniture, appliances, building waste · we’ll reach you within 48 hours of your chosen day.')}</p></div>
      </div>
      <div className="v-book">
        <form className="v-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <section className="ftc-card v-sec" aria-labelledby="b1">
            <header><h2 className="w-h3" id="b1">{tr('إيه اللي محتاج يترفع؟', 'What needs to be picked up?')}</h2><span>{tr('اختار واحد أو أكتر', 'Choose one or more')}</span></header>
            <ItemChecks label={tr('إيه اللي محتاج يترفع؟', 'What needs to be picked up?')} value={items} onChange={(v) => { setItems(v); setErrors((e) => ({ ...e, items: undefined })); }} />
            {errors.items ? <span className="a-err" role="alert">{errors.items}</span> : null}
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b2">
            <header><h2 className="w-h3" id="b2">{tr('اختار الميعاد', 'Pick a time')}</h2><span>{tr('الخدمة من الأحد للخميس', 'Available Sunday to Thursday')}</span></header>
            <DayPicker days={days} value={day} onChange={setDay} />
            <div className="ftc-field">
              <span className="ftc-label" id="sl">{tr('الفترة', 'Time slot')}</span>
              <ChoiceGroup className="v-pair" labelledBy="sl" options={SLOTS.map((s) => ({ id: s.id, label: slotLabelFor(s) }))} value={slot} onChange={setSlot} />
            </div>
            {errors.day ? <span className="a-err" role="alert">{errors.day}</span> : null}
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b3">
            <header><h2 className="w-h3" id="b3">{tr('طريقة الدفع', 'Payment method')}</h2><span>{tr('الرسوم', 'Fee')}: {tr(FEE_LABEL.replace(/[[\]]/g, ''), FEE_LABEL_EN)}</span></header>
            <ChoiceGroup className="v-pay" label={tr('طريقة الدفع', 'Payment method')} options={PAYMENT_METHODS.map((p) => ({ id: p.id, label: paymentLabelFor(p) }))} value={payment} onChange={setPayment} />
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b4">
            <h2 className="w-h3" id="b4">{tr('العنوان', 'Address')}</h2>
            <div className="v-pair">
              <div className="ftc-field">
                <label className="ftc-label" htmlFor="ar">{tr('المنطقة', 'Area')}</label>
                <input className="ftc-input" id="ar" value={address} aria-invalid={!!errors.address} onChange={(e) => { setAddress(e.target.value); setErrors((er) => ({ ...er, address: undefined })); }} />
                {errors.address ? <span className="a-err" role="alert">{errors.address}</span> : null}
              </div>
              <div className="ftc-field"><label className="ftc-label" htmlFor="lmk">{tr('علامة مميزة (اختياري)', 'Landmark (optional)')}</label><input className="ftc-input" id="lmk" placeholder={tr('مثلًا: عمارة ١٢ جنب الصيدلية', 'e.g. Building 12, next to the pharmacy')} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
            </div>
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        <aside className="v-sum" aria-label={tr('ملخص الحجز', 'Booking summary')}>
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 14 }}>{tr('ملخص الحجز', 'Booking summary')}</h2>
            <dl>
              <dt>{tr('الخدمة', 'Service')}</dt><dd>{tr('رفع مخلفات كبيرة', 'Bulky waste pickup')}</dd>
              <dt>{tr('اللي هيترفع', 'To be picked up')}</dt><dd>{items.length ? items.map(itemLabel).join(tr('، ', ', ')) : tr('لسه مفيش', 'Nothing yet')}</dd>
              <dt>{tr('اليوم', 'Day')}</dt><dd>{dayLabel(day)}</dd>
              <dt>{tr('الفترة', 'Time slot')}</dt><dd>{slotLabel(slot)}</dd>
              <dt>{tr('طريقة الدفع', 'Payment method')}</dt><dd>{paymentLabel(payment)}</dd>
              <dt>{tr('الرسوم', 'Fee')}</dt><dd>{tr(FEE_LABEL.replace(/[[\]]/g, ''), FEE_LABEL_EN)}</dd>
              <dt>{tr('العنوان', 'Address')}</dt><dd>{[address, landmark].filter(Boolean).join(' · ')}</dd>
            </dl>
          </div>
          <div className="ftc-notice"><Icon name="info" size={20} className="w-notice-ic" /><span>{tr('مش هنطلب منك أي فلوس قبل ما تشوف الرسوم المعلنة للحي.', 'We won’t ask you for any money before you see the district’s published fee.')}</span></div>
          {submitError ? <span className="a-err" role="alert">{submitError}</span> : null}
          <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="button" disabled={busy} onClick={() => void submit()} data-testid="book-submit">
            {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('احجز الميعاد', 'Book a slot')}
          </button>
        </aside>
      </div>
    </main>
  );
}

/** Multi-select tick boxes for the bulky items: the value is the Arabic item, the label follows the language. */
function ItemChecks({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="v-items" role="group" aria-label={label}>
      {BULKY_ITEMS.map((o) => {
        const on = value.includes(o);
        const toggle = () => onChange(on ? value.filter((x) => x !== o) : [...value, o]);
        return (
          <div
            key={o}
            className={`w-choice chk${on ? ' is-on' : ''}`}
            role="checkbox"
            aria-checked={on}
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggle();
              }
            }}
          >
            <span className="mk"><Icon name="check" size={14} strokeWidth={2.5} /></span>
            {itemLabel(o)}
          </div>
        );
      })}
    </div>
  );
}
