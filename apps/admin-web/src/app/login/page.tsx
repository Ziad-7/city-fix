'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffLogin } from '@/services/auth';
import { getSession, setSession } from '@/lib/session';
import { ApiError } from '@/lib/http';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [district, setDistrict] = useState('cairo-nasr-first');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showForgotNotice, setShowForgotNotice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace('/');
    }
  }, [router]);

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setEmailError('اكتب البريد الإلكتروني');
      return false;
    }
    if (!value.includes('@') || !value.includes('.')) {
      setEmailError('البريد مش مكتوب صح');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) {
      setPasswordError('اكتب كلمة السر');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailBlur = () => {
    validateEmail(email);
  };

  const handlePasswordBlur = () => {
    validatePassword(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate both fields
    const emailValid = validateEmail(email);
    const passwordValid = validatePassword(password);

    if (!emailValid || !passwordValid) {
      return;
    }

    setLoading(true);

    try {
      const session = await staffLogin(email, password);
      setSession(session, { remember: rememberDevice });
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('مفيش اتصال بالسيرفر. جرّب تاني.');
      }
      // Reset focus to email field on error
      setTimeout(() => {
        document.getElementById('email')?.focus();
      }, 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <section className="login-hero" aria-label="مركز القيادة">
        <div className="top">
          <div className="lockup">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/fixthecity-mark.svg" alt="" width={48} height={48} />
            <b>FixTheCity</b>
          </div>
          <h1>مركز القيادة</h1>
          <p>من البلاغ لحد ما يتصلّح. افرز، وزّع، وتابع شغل الحي من مكان واحد.</p>
          <div className="tags">
            <span className="tag">فرز بالأولوية</span>
            <span className="tag">أوامر شغل</span>
            <span className="tag">خريطة المدينة</span>
            <span className="tag">ميزانية الإصلاحات</span>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/cairo-skyline.svg" alt="" className="skyline" width={390} height={150} />
      </section>

      <section className="login-form" aria-label="تسجيل الدخول">
        <form onSubmit={handleSubmit}>
          <div>
            <h2>دخول الموظفين</h2>
            <p className="sub">سجّل دخولك بحساب الحي للوصول لقائمة البلاغات وأوامر الشغل.</p>
          </div>

          <div className="ftc-field">
            <label htmlFor="email" className="ftc-label">
              البريد الإلكتروني للشغل
            </label>
            <input
              id="email"
              className="ftc-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="name@example.com"
              autoComplete="username"
              dir="ltr"
              disabled={loading}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
            {emailError && (
              <div id="email-error" className="ftc-error">
                {emailError}
              </div>
            )}
          </div>

          <div className="ftc-field">
            <label htmlFor="password" className="ftc-label">
              كلمة السر
            </label>
            <div className="pw">
              <input
                id="password"
                className="ftc-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                placeholder="••••••••"
                autoComplete="current-password"
                dir="ltr"
                disabled={loading}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                aria-pressed={showPassword}
                disabled={loading}
              >
                <Icon name={showPassword ? 'eye' : 'eye-slash'} size={20} />
              </button>
            </div>
            {passwordError && (
              <div id="password-error" className="ftc-error">
                {passwordError}
              </div>
            )}
          </div>

          <div className="ftc-field">
            <label htmlFor="district" className="ftc-label">
              الحي
            </label>
            <select
              id="district"
              className="ftc-input"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={loading}
            >
              <option value="cairo-nasr-first">القاهرة · حي مدينة نصر أول</option>
              <option value="cairo-nasr-second">القاهرة · حي مدينة نصر ثان</option>
              <option value="cairo-heliopolis">القاهرة · حي مصر الجديدة</option>
            </select>
          </div>

          <div className="row">
            <label className="chk">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                disabled={loading}
              />
              افضل مسجّل على الجهاز ده
            </label>
            <button
              type="button"
              className="ftc-link"
              onClick={() => setShowForgotNotice(!showForgotNotice)}
            >
              نسيت كلمة السر؟
            </button>
          </div>

          {showForgotNotice && (
            <div className="notice" style={{ backgroundColor: 'var(--ftc-gold-soft)', borderLeft: '4px solid var(--ftc-gold)' }}>
              كلّم مشرف النظام عشان يعيد تعيين كلمة السر.
            </div>
          )}

          {error && (
            <div className="notice notice--danger" role="alert">
              <Icon name="alert-triangle" size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="ftc-btn ftc-btn--primary ftc-btn--block"
            disabled={loading}
            style={{ height: '52px' }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                بندخّلك…
              </>
            ) : (
              'دخول'
            )}
          </button>

          <div className="staff-note">
            <Icon name="lock" size={16} />
            <span>للموظفين فقط. بلاغات المواطنين بتيجي من التطبيق أو الموقع.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
