'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DEFAULT_DISTRICT, GOVERNORATES, findGovernorate } from '@/domain/locations';
import { otpSchema, phoneSchema } from '@/domain/schemas';
import type { OtpChannel } from '@/domain/types';
import { API_MODE, MOCK_OTP, services } from '@/services';
import { ApiError } from '@/services/api/http';
import { useIsSignedIn, useSession, useSessionHydrated } from '@/store';
import { maskPhone, normalizeEgyptPhone, toArabicDigits, toWesternDigits } from '@/utils/digits';
import { LogoMark, Skyline } from '@/ui/brand';
import { ChoiceGroup, SelectField, ToggleRow } from '@/ui/controls';
import { Icon } from '@/ui/Icon';

type Step = 'phone' | 'code';

const CHANNELS: { id: OtpChannel; label: string }[] = [
  { id: 'sms', label: 'رسالة SMS' },
  { id: 'whatsapp', label: 'واتساب' },
];

/** Only same-site paths are allowed as the post-sign-in destination. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const hydrated = useSessionHydrated();
  const signedIn = useIsSignedIn();
  const { governorate: savedGov, district: savedDistrict, otpChannel, prefs, notice, setOtpChannel, setPrefs, startSession } = useSession();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [governorate, setGovernorate] = useState(savedGov);
  const [district, setDistrict] = useState(savedDistrict);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // Already signed in (e.g. opened /sign-in from history): go straight in.
  useEffect(() => {
    if (hydrated && signedIn && !busy) router.replace(next);
  }, [hydrated, signedIn, busy, router, next]);

  useEffect(() => {
    if (step === 'code') boxes.current[0]?.focus();
  }, [step]);

  const districts = findGovernorate(governorate)?.districts ?? [];
  const changeGovernorate = (name: string) => {
    setGovernorate(name);
    setDistrict(findGovernorate(name)?.districts[0]?.nameAr ?? DEFAULT_DISTRICT);
  };

  const sendCode = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await services.auth.requestCode(normalizeEgyptPhone(phone), otpChannel);
      setStep('code');
    } catch (e) {
      // http.ts words network and server trouble in Arabic already; keep that instead of a vague line.
      setError(e instanceof Error && e.message ? e.message : 'معرفناش نبعت الكود، جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (digits: string) => {
    if (busy) return;
    const parsed = otpSchema.safeParse(digits);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const session = await services.auth.verifyCode(normalizeEgyptPhone(phone), digits);
      startSession(session, { governorate, district });
      router.replace(next);
    } catch (e) {
      // Only a refused code is "wrong code"; no network or a server error says what happened.
      const refused = e instanceof ApiError && [400, 401, 403, 404, 422].includes(e.status);
      setError(!refused && e instanceof Error && e.message ? e.message : 'الكود مش صح، جرّب تاني');
      setBusy(false);
    }
  };

  const setDigits = (from: number, raw: string) => {
    let incoming = toWesternDigits(raw).replace(/\D/g, '');
    // Typing into a filled box: keep the new digit, not the old one in front of it.
    const prev = code[from];
    if (prev && incoming.length === 2 && incoming.startsWith(prev)) incoming = incoming.slice(1);
    const nextCode = [...code];
    if (!incoming) {
      nextCode[from] = '';
    } else {
      // Typing one digit fills one box; pasting the whole code fills them all.
      incoming.slice(0, 6 - from).split('').forEach((d, i) => (nextCode[from + i] = d));
    }
    setCode(nextCode);
    setError(null);
    const filled = nextCode.join('');
    if (incoming) boxes.current[Math.min(5, from + incoming.length)]?.focus();
    // The 6th digit submits the code, like the app.
    if (filled.length === 6) void verify(filled);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'phone') void sendCode();
    else void verify(code.join(''));
  };

  const showSoon = () => setSoon('الميزة دي قريبًا، هتتضاف في نسخة جاية.');
  const channelLabel = otpChannel === 'whatsapp' ? 'واتساب' : 'رسالة SMS';

  return (
    <div className="s-split">
      <section className="s-hero" aria-label="سيتي فيكس">
        <span className="s-pill"><LogoMark size={28} />سيتي فيكس</span>
        <h2 className="ftc-slogan">مدينتك أحلى لما نصلّحها سوا</h2>
        <p>بلّغ.. وإحنا نتابع لحد ما تتصلّح. صوّر المشكلة، ونوصّلها للجهة المسؤولة، ونبعتلك كل خطوة.</p>
        <Skyline className="s-sky" />
      </section>
      <main className="s-formside" id="main">
        <div className="s-form">
          <form className="ftc-card ftc-card--lg s-card" onSubmit={submit} noValidate>
            <div className="w-stack">
              {notice ? <div className="ftc-notice" role="status" data-testid="session-notice"><Icon name="info" size={18} className="w-notice-ic" /><span>{notice}</span></div> : null}
              {step === 'phone' ? (
                <>
                  <div className="s-head"><span className="w-step">خطوة ١ من ٢</span><h1>أهلًا بيك</h1><p>ادخل برقم موبايلك عشان تبلّغ وتتابع طلباتك.</p></div>
                  <div className="ftc-field">
                    <label className="ftc-label" htmlFor="phone">رقم موبايلك</label>
                    <div className="s-phone">
                      <span className="s-cc"><span className="w-flag" aria-hidden="true"><i style={{ background: '#C8102E' }} /><i style={{ background: '#fff' }} /><i style={{ background: '#161616' }} /></span>+20</span>
                      <input
                        id="phone"
                        data-testid="phone-input"
                        type="tel"
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="010 1234 5678"
                        autoComplete="tel-national"
                        maxLength={13}
                        value={phone}
                        aria-invalid={!!error}
                        aria-describedby="phone-help"
                        onChange={(e) => {
                          setPhone(toWesternDigits(e.target.value).replace(/[^\d ]/g, ''));
                          setError(null);
                        }}
                      />
                    </div>
                    {error ? <span className="a-err" role="alert" id="phone-help">{error}</span> : <span className="ftc-help" id="phone-help">فودافون، أورانج، اتصالات، أو WE — هنبعتلك كود من ٦ أرقام.</span>}
                  </div>
                  <div className="ftc-field">
                    <span className="ftc-label" id="ch-l">ابعتلي الكود على</span>
                    <ChoiceGroup className="s-pair" labelledBy="ch-l" options={CHANNELS} value={otpChannel} onChange={setOtpChannel} />
                  </div>
                  <div className="s-pair">
                    <SelectField id="gov" label="المحافظة" value={governorate} onChange={changeGovernorate} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: g.nameAr }))} />
                    <SelectField id="dist" label="الحي" value={district} onChange={setDistrict} options={districts.map((d) => ({ value: d.nameAr, label: d.nameAr }))} />
                  </div>
                  <div className="s-privacy"><Icon name="shield-check" size={20} /><span>رقمك مش هيظهر لحد. بنستخدمه بس عشان نبعتلك تحديثات بلاغك، وتقدر تبلّغ من غير اسم.</span></div>
                  <ToggleRow icon="wifi" title="توفير باقة النت" subtitle="صور أخف، والخريطة بتحمّل بس لما تفتحها" on={prefs.dataSaver} onChange={(v) => setPrefs({ dataSaver: v })} />
                  <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="submit" style={{ height: 52 }} disabled={busy} data-testid="sign-in-submit">
                    {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}ابعتلي الكود
                  </button>
                  {soon ? <div className="ftc-notice" role="status"><span>{soon}</span></div> : null}
                  <div className="s-links"><button type="button" className="w-link" onClick={showSoon}>English</button><i>|</i><button type="button" className="w-link" onClick={showSoon}>خط أكبر</button></div>
                </>
              ) : (
                <>
                  <div className="s-head">
                    <span className="w-step">خطوة ٢ من ٢</span>
                    <h1>اكتب الكود</h1>
                    <p>بعتنا كود من ٦ أرقام على {channelLabel} للرقم <bdi dir="ltr">{maskPhone(phone)}</bdi>.</p>
                  </div>
                  <div className="ftc-field">
                    <span className="ftc-label" id="otp-l">الكود</span>
                    <div className="s-otp" role="group" aria-labelledby="otp-l" dir="ltr">
                      {code.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            boxes.current[i] = el;
                          }}
                          className={d ? 'f' : undefined}
                          data-testid={`otp-${i}`}
                          inputMode="numeric"
                          autoComplete={i === 0 ? 'one-time-code' : 'off'}
                          maxLength={6}
                          aria-label={`الرقم ${toArabicDigits(i + 1)}`}
                          placeholder="·"
                          value={d ? toArabicDigits(d) : ''}
                          onChange={(e) => setDigits(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !code[i] && i > 0) boxes.current[i - 1]?.focus();
                          }}
                        />
                      ))}
                    </div>
                    {error ? <span className="a-err" role="alert">{error}</span> : null}
                  </div>
                  {API_MODE === 'mock' ? (
                    <div className="ftc-notice s-hint"><Icon name="info" size={18} /><span>الكود التجريبي: <b>{toArabicDigits(MOCK_OTP)}</b></span></div>
                  ) : null}
                  <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="submit" style={{ height: 52 }} disabled={busy} data-testid="sign-in-submit">
                    {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}دخول
                  </button>
                  <div className="s-links">
                    <button type="button" className="w-link" onClick={() => { setStep('phone'); setCode(['', '', '', '', '', '']); setError(null); }}>غيّر الرقم</button>
                  </div>
                </>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
