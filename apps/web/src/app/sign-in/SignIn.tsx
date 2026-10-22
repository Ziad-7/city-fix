'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DEFAULT_DISTRICT, GOVERNORATES, findGovernorate } from '@/domain/locations';
import { otpSchema, phoneSchema } from '@/domain/schemas';
import type { OtpChannel } from '@/domain/types';
import { API_MODE, MOCK_OTP, services } from '@/services';
import { ApiError } from '@/services/api/http';
import { useIsSignedIn, useSession, useSessionHydrated } from '@/store';
import { placeName, setLang, useLang, useTr } from '@/i18n';
import { useDocumentLang } from '@/lib/useDocumentLang';
import { usePageTitle } from '@/lib/usePageTitle';
import { localDigits, maskPhone, normalizeEgyptPhone, toWesternDigits } from '@/utils/digits';
import { LogoMark, Skyline } from '@/ui/brand';
import { ChoiceGroup, SelectField, ToggleRow } from '@/ui/controls';
import { Icon } from '@/ui/Icon';

type Step = 'phone' | 'code';

/** Only same-site paths are allowed as the post-sign-in destination. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export function SignIn() {
  const tr = useTr();
  const lang = useLang();
  useDocumentLang();
  usePageTitle(tr('الدخول', 'Sign in'));
  const CHANNELS: { id: OtpChannel; label: string }[] = [
    { id: 'sms', label: tr('رسالة SMS', 'SMS') },
    { id: 'whatsapp', label: tr('واتساب', 'WhatsApp') },
  ];
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
      // http.ts words network and server trouble in the current language already; keep that instead of a vague line.
      setError(e instanceof Error && e.message ? e.message : tr('معرفناش نبعت الكود، جرّب تاني', 'We couldn’t send the code. Try again'));
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
      setError(!refused && e instanceof Error && e.message ? e.message : tr('الكود مش صح، جرّب تاني', 'That code isn’t right. Try again'));
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

  const showSoon = () => setSoon(tr('الميزة دي قريبًا، هتتضاف في نسخة جاية.', 'This feature is coming soon, in a later version.'));
  const channelLabel = otpChannel === 'whatsapp' ? tr('واتساب', 'WhatsApp') : tr('رسالة SMS', 'SMS');
  // A validation message was written in the old language: drop it rather than show it in the wrong one.
  const switchLang = () => {
    setError(null);
    setSoon(null);
    setLang(lang === 'en' ? 'ar' : 'en');
  };

  return (
    <div className="s-split">
      <section className="s-hero" aria-label={tr('سيتي فيكس', 'CityFix')}>
        <span className="s-pill"><LogoMark size={28} />{tr('سيتي فيكس', 'CityFix')}</span>
        <h2 className="ftc-slogan">{tr('مدينتك أحلى لما نصلّحها سوا', 'Your city is better when we fix it together')}</h2>
        <p>{tr('بلّغ.. وإحنا نتابع لحد ما تتصلّح. صوّر المشكلة، ونوصّلها للجهة المسؤولة، ونبعتلك كل خطوة.', 'Report it, and we’ll follow it until it’s fixed. Take a photo, we’ll get it to the right department, and we’ll update you at every step.')}</p>
        <Skyline className="s-sky" />
      </section>
      <main className="s-formside" id="main">
        <div className="s-form">
          <form className="ftc-card ftc-card--lg s-card" onSubmit={submit} noValidate>
            <div className="w-stack">
              {notice ? <div className="ftc-notice" role="status" data-testid="session-notice"><Icon name="info" size={18} className="w-notice-ic" /><span>{notice}</span></div> : null}
              {step === 'phone' ? (
                <>
                  <div className="s-head"><span className="w-step">{tr('خطوة ١ من ٢', 'Step 1 of 2')}</span><h1>{tr('أهلًا بيك', 'Welcome')}</h1><p>{tr('ادخل برقم موبايلك عشان تبلّغ وتتابع طلباتك.', 'Enter your mobile number to report and follow your requests.')}</p></div>
                  <div className="ftc-field">
                    <label className="ftc-label" htmlFor="phone">{tr('رقم موبايلك', 'Your mobile number')}</label>
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
                    {error ? <span className="a-err" role="alert" id="phone-help">{error}</span> : <span className="ftc-help" id="phone-help">{tr('فودافون، أورانج، اتصالات، أو WE — هنبعتلك كود من ٦ أرقام.', 'Vodafone, Orange, Etisalat or WE — we’ll send you a 6-digit code.')}</span>}
                  </div>
                  <div className="ftc-field">
                    <span className="ftc-label" id="ch-l">{tr('ابعتلي الكود على', 'Send me the code by')}</span>
                    <ChoiceGroup className="s-pair" labelledBy="ch-l" options={CHANNELS} value={otpChannel} onChange={setOtpChannel} />
                  </div>
                  <div className="s-pair">
                    <SelectField id="gov" label={tr('المحافظة', 'Governorate')} value={governorate} onChange={changeGovernorate} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: placeName(g.nameAr) }))} />
                    <SelectField id="dist" label={tr('الحي', 'District')} value={district} onChange={setDistrict} options={districts.map((d) => ({ value: d.nameAr, label: placeName(d.nameAr) }))} />
                  </div>
                  <div className="s-privacy"><Icon name="shield-check" size={20} /><span>{tr('رقمك مش هيظهر لحد. بنستخدمه بس عشان نبعتلك تحديثات بلاغك، وتقدر تبلّغ من غير اسم.', 'Your number won’t be shown to anyone. We only use it to send you updates on your report, and you can report without your name.')}</span></div>
                  <ToggleRow icon="wifi" title={tr('توفير باقة النت', 'Data saver')} subtitle={tr('صور أخف، والخريطة بتحمّل بس لما تفتحها', 'Lighter photos, and the map only loads when you open it')} on={prefs.dataSaver} onChange={(v) => setPrefs({ dataSaver: v })} />
                  <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="submit" style={{ height: 52 }} disabled={busy} data-testid="sign-in-submit">
                    {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('ابعتلي الكود', 'Send me the code')}
                  </button>
                  {soon ? <div className="ftc-notice" role="status"><span>{soon}</span></div> : null}
                  <div className="s-links"><button type="button" className="w-link" data-testid="lang-link" lang={lang === 'en' ? 'ar' : 'en'} onClick={switchLang}>{lang === 'en' ? 'العربية' : 'English'}</button><i>|</i><button type="button" className="w-link" onClick={showSoon}>{tr('خط أكبر', 'Larger text')}</button></div>
                </>
              ) : (
                <>
                  <div className="s-head">
                    <span className="w-step">{tr('خطوة ٢ من ٢', 'Step 2 of 2')}</span>
                    <h1>{tr('اكتب الكود', 'Enter the code')}</h1>
                    <p>{tr('بعتنا كود من ٦ أرقام على ', 'We sent a 6-digit code by ')}{channelLabel}{tr(' للرقم ', ' to ')}<bdi dir="ltr">{maskPhone(phone)}</bdi>.</p>
                  </div>
                  <div className="ftc-field">
                    <span className="ftc-label" id="otp-l">{tr('الكود', 'Code')}</span>
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
                          aria-label={tr(`الرقم ${localDigits(i + 1)}`, `Digit ${i + 1}`)}
                          placeholder="·"
                          value={d ? localDigits(d) : ''}
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
                    <div className="ftc-notice s-hint"><Icon name="info" size={18} /><span>{tr('الكود التجريبي: ', 'Test code: ')}<b>{localDigits(MOCK_OTP)}</b></span></div>
                  ) : null}
                  <button className="ftc-btn ftc-btn--primary ftc-btn--block" type="submit" style={{ height: 52 }} disabled={busy} data-testid="sign-in-submit">
                    {busy ? <span className="a-spin a-spin--on-red" aria-hidden="true" /> : null}{tr('دخول', 'Sign in')}
                  </button>
                  <div className="s-links">
                    <button type="button" className="w-link" onClick={() => { setStep('phone'); setCode(['', '', '', '', '', '']); setError(null); }}>{tr('غيّر الرقم', 'Change number')}</button>
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
