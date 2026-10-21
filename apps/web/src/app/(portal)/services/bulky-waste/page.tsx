'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import { bulkyBookingSchema, placeSchema } from '@/domain/schemas';
import { BULKY_ITEMS, FEE_LABEL, PAYMENT_METHODS, SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import type { PaymentMethod, SlotId } from '@/domain/types';
import { dayLabel, dayParts, parseIsoDay } from '@/components/services/day';
import { paymentLabel, slotLabel } from '@/components/requests/labels';
import { useServiceRequests, useSession } from '@/store';
import { CheckGroup, ChoiceGroup } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { usePageTitle } from '@/lib/usePageTitle';

type Errors = Partial<Record<'items' | 'day' | 'address', string>>;

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** Bulky-waste pickup booking (same rules as apps/mobile/src/app/services/bulky-waste.tsx). */
export default function BulkyWastePage() {
  usePageTitle('رفع مخلفات كبيرة');
  const router = useRouter();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const bookService = useServiceRequests((s) => s.bookService);

  const days = useMemo(() => nextWorkingDays(5), []);
  const [items, setItems] = useState<string[]>([]);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [address, setAddress] = useState(`${district}، ${governorate}`);
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
        next[key] ??= issue.message;
      }
    }
    const center = findDistrict(governorate, district) ?? DEFAULT_PLACE;
    const place = placeSchema.safeParse({ lat: center.lat, lng: center.lng, address: address.trim(), landmark: landmark.trim() || undefined });
    if (!place.success) next.address = place.error.issues[0].message;
    setErrors(next);
    setSubmitError(null);
    if (!parsed.success || !place.success) return;

    setBusy(true);
    try {
      const req = await bookService({ serviceType: 'bulky_waste', details: parsed.data, location: place.data });
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'معرفناش نحجز الميعاد، جرّب تاني');
      setBusy(false);
    }
  };

  return (
    <main className="ftc-web-main" id="main">
      <Link className="w-back" href="/services"><Icon name="arrow-back" size={18} />خدمات المدينة</Link>
      <div className="w-sec-head" style={{ marginBottom: 20 }}>
        <div><h1 className="w-h1">رفع مخلفات كبيرة</h1><p className="w-sub">عفش قديم، أجهزة، مخلفات بناء · بنوصلك خلال ٤٨ ساعة من الميعاد.</p></div>
      </div>
      <div className="v-book">
        <form className="v-form" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <section className="ftc-card v-sec" aria-labelledby="b1">
            <header><h2 className="w-h3" id="b1">إيه اللي محتاج يترفع؟</h2><span>اختار واحد أو أكتر</span></header>
            <CheckGroup className="v-items" label="إيه اللي محتاج يترفع؟" options={BULKY_ITEMS} value={items} onChange={(v) => { setItems(v); setErrors((e) => ({ ...e, items: undefined })); }} />
            {errors.items ? <span className="a-err" role="alert">{errors.items}</span> : null}
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b2">
            <header><h2 className="w-h3" id="b2">اختار الميعاد</h2><span>الخدمة من الأحد للخميس</span></header>
            <ChoiceGroup
              className="v-days"
              label="اليوم"
              marker={false}
              value={day}
              onChange={setDay}
              testIdPrefix="day"
              options={days.map((d) => {
                const p = dayParts(d);
                return {
                  id: d,
                  ariaLabel: dayLabel(d),
                  className: 'v-day',
                  style: { flexDirection: 'column', padding: '12px 4px', gap: 2 },
                  label: <><span>{p.weekday}</span><b>{p.dayOfMonth}</b><small>{MONTHS[parseIsoDay(d).getMonth()]}</small></>,
                };
              })}
            />
            <div className="ftc-field">
              <span className="ftc-label" id="sl">الفترة</span>
              <ChoiceGroup className="v-pair" labelledBy="sl" options={SLOTS.map((s) => ({ id: s.id, label: s.labelAr }))} value={slot} onChange={setSlot} />
            </div>
            {errors.day ? <span className="a-err" role="alert">{errors.day}</span> : null}
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b3">
            <header><h2 className="w-h3" id="b3">طريقة الدفع</h2><span>الرسوم: حسب لائحة الحي</span></header>
            <ChoiceGroup className="v-pay" label="طريقة الدفع" options={PAYMENT_METHODS.map((p) => ({ id: p.id, label: p.labelAr }))} value={payment} onChange={setPayment} />
          </section>
          <section className="ftc-card v-sec" aria-labelledby="b4">
            <h2 className="w-h3" id="b4">العنوان</h2>
            <div className="v-pair">
              <div className="ftc-field">
                <label className="ftc-label" htmlFor="ar">المنطقة</label>
                <input className="ftc-input" id="ar" value={address} aria-invalid={!!errors.address} onChange={(e) => { setAddress(e.target.value); setErrors((er) => ({ ...er, address: undefined })); }} />
                {errors.address ? <span className="a-err" role="alert">{errors.address}</span> : null}
              </div>
              <div className="ftc-field"><label className="ftc-label" htmlFor="lmk">علامة مميزة (اختياري)</label><input className="ftc-input" id="lmk" placeholder="مثلًا: عمارة ١٢ جنب الصيدلية" value={landmark} onChange={(e) => setLandmark(e.target.value)} /></div>
            </div>
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        <aside className="v-sum" aria-label="ملخص الحجز">
          <div className="ftc-card">
            <h2 className="w-h3" style={{ marginBottom: 14 }}>ملخص الحجز</h2>
            <dl>
              <dt>الخدمة</dt><dd>رفع مخلفات كبيرة</dd>
              <dt>اللي هيترفع</dt><dd>{items.length ? items.join('، ') : 'لسه مفيش'}</dd>
              <dt>اليوم</dt><dd>{dayLabel(day)}</dd>
              <dt>الفترة</dt><dd>{slotLabel(slot)}</dd>
              <dt>طريقة الدفع</dt><dd>{paymentLabel(payment)}</dd>
              <dt>الرسوم</dt><dd>{FEE_LABEL.replace(/[[\]]/g, '')}</dd>
              <dt>العنوان</dt><dd>{[address, landmark].filter(Boolean).join(' · ')}</dd>
            </dl>
          </div>
          <div className="ftc-notice"><Icon name="info" size={20} className="w-notice-ic" /><span>مش هنطلب منك أي فلوس قبل ما تشوف الرسوم المعلنة للحي.</span></div>
          {submitError ? <span className="a-err" role="alert">{submitError}</span> : null}
          <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="button" disabled={busy} onClick={() => void submit()} data-testid="book-submit">
            {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}احجز الميعاد
          </button>
        </aside>
      </div>
    </main>
  );
}
