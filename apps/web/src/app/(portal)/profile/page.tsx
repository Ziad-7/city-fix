'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GOVERNORATES, findGovernorate } from '@/domain/locations';
import { medalFor, remainingLine } from '@/domain/medals';
import { isOpenStatus } from '@/domain/types';
import { signOutAll, useReports, useSession } from '@/store';
import { useCollector } from '@/store/useCollector';
import { setLang, useLang, useTr, medalTitle, placeName, type Lang } from '@/i18n';
import { localDigits, maskPhone } from '@/utils/digits';
import { MedalIcon } from '@/ui/brand';
import { SelectField, ToggleRow } from '@/ui/controls';
import { SosGrid } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';
import { usePageTitle } from '@/lib/usePageTitle';

const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
];

export default function ProfilePage() {
  const tr = useTr();
  const lang = useLang();
  usePageTitle(tr('حسابي', 'Account'));
  const router = useRouter();
  const { phone, name, governorate, district, prefs, setArea, setPrefs, setName } = useSession();
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);

  const collector = useCollector((s) => s.collector);
  const loadMe = useCollector((s) => s.loadMe);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const [draft, setDraft] = useState(name ?? '');
  const [saved, setSaved] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const stats = useMemo(() => {
    const byId = new Map(incidents.map((i) => [i.id, i]));
    const fixed = reports.filter((r) => {
      const inc = byId.get(r.incidentId);
      return inc ? !isOpenStatus(inc.status) : false;
    }).length;
    return { reports: reports.length, fixed };
  }, [reports, incidents]);
  const medal = medalFor(stats.reports);

  const trimmed = draft.trim();
  const dirty = trimmed !== (name ?? '');
  const initial = (name ?? '').trim().charAt(0);
  const districts = findGovernorate(governorate)?.districts ?? [];
  const masked = phone ? maskPhone(phone) : '';

  const saveName = () => {
    setName(trimmed || null);
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2000);
  };

  const signOut = async () => {
    await signOutAll();
    router.replace('/sign-in');
  };

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head"><div><h1 className="w-h1">{tr('حسابي', 'Account')}</h1><p className="w-sub">{tr('بياناتك، منطقتك، وإعدادات التحديثات.', 'Your details, your area and your update settings.')}</p></div></div>
      <div className="p-grid">
        <div className="p-main">
          <section className="ftc-card p-sec" aria-labelledby="pa">
            <div className="p-id">
              <span className="p-av" role="img" aria-label={tr('صورة الحساب', 'Profile picture')}>{initial ? <b className="a-initial">{initial}</b> : <Icon name="user" size={34} />}</span>
              <span><b id="pa">{name || tr('من غير اسم', 'No name yet')}</b><span dir="ltr"><bdi>{masked}</bdi></span></span>
            </div>
            <form className="p-namerow" onSubmit={(e) => { e.preventDefault(); if (dirty) saveName(); }}>
              <div className="ftc-field"><label className="ftc-label" htmlFor="nm">{tr('الاسم', 'Name')}</label><input className="ftc-input" id="nm" data-testid="name-input" value={draft} placeholder={tr('اسمك (اختياري)', 'Your name (optional)')} onChange={(e) => setDraft(e.target.value)} /></div>
              <button className="ftc-btn ftc-btn--secondary" type="submit" style={{ height: 48 }} disabled={!dirty} data-testid="name-save">{tr('حفظ', 'Save')}</button>
            </form>
            {saved ? <span className="ftc-caption" style={{ color: 'var(--ftc-status-resolved)' }} role="status">{tr('اتحفظ الاسم', 'Name saved')}</span> : null}
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pz">
            <h2 className="w-h3" id="pz">{tr('منطقتك', 'Your area')}</h2>
            <div className="p-pair">
              <SelectField id="g" label={tr('المحافظة', 'Governorate')} value={governorate} onChange={(g) => setArea(g, findGovernorate(g)?.districts[0]?.nameAr ?? district)} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: placeName(g.nameAr) }))} />
              <SelectField id="d" label={tr('الحي', 'District')} value={district} onChange={(d) => setArea(governorate, d)} options={districts.map((d) => ({ value: d.nameAr, label: placeName(d.nameAr) }))} />
            </div>
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pp">
            <h2 className="w-h3" id="pp">{tr('التحديثات والإعدادات', 'Updates and settings')}</h2>
            <ToggleRow icon="whatsapp" title={tr('تحديثات واتساب', 'WhatsApp updates')} subtitle={<>{tr('على رقم', 'To')} <bdi dir="ltr">{masked}</bdi> — {tr('ولو مفيش نت هتوصلك SMS', "and if there's no internet, we'll send an SMS")}</>} on={prefs.whatsappUpdates} onChange={(v) => setPrefs({ whatsappUpdates: v })} />
            <ToggleRow icon="wifi" title={tr('توفير البيانات', 'Data saver')} subtitle={tr('صور أخف، والخريطة بتتحمّل لما تطلبها', 'Lighter photos, and the map loads only when you ask')} on={prefs.dataSaver} onChange={(v) => setPrefs({ dataSaver: v })} />
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pl">
            <h2 className="w-h3" id="pl">{tr('اللغة', 'Language')}</h2>
            <div className="p-langopts" role="radiogroup" aria-labelledby="pl">
              {LANGUAGES.map((l) => (
                <label key={l.id} className="p-langopt">
                  <input type="radio" name="lang" value={l.id} checked={lang === l.id} onChange={() => setLang(l.id)} data-testid={`lang-${l.id}`} />
                  <span lang={l.id}>{l.label}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pc">
            <h2 className="w-h3" id="pc">{tr('سيتي سايكل', 'CityCycle')}</h2>
            <div className="p-links">
              <Link className="ftc-btn ftc-btn--secondary" href="/impact" data-testid="open-impact"><Icon name="leaf" size={20} />{tr('أثري في التدوير', 'My recycling impact')}</Link>
              <Link className="ftc-btn ftc-btn--secondary" href="/recycling-guide" data-testid="open-recycling-guide"><Icon name="recycle" size={20} />{tr('دليل التدوير', 'Recycling guide')}</Link>
            </div>
            {collector ? (
              <div className="w-rowcard" data-testid="collector-card">
                <span className="ftc-icon-well"><Icon name="truck" size={20} /></span>
                <span className="w-grow">
                  <span className="w-t">{tr('وضع الجامع', 'Collector mode')}</span>
                  <span className="w-m">{tr('استخدم تطبيق CityFix على موبايلك لوضع الجامع.', 'Use the CityFix app on your phone for collector mode.')}</span>
                </span>
              </div>
            ) : null}
          </section>
          <section className="ftc-card p-sec" aria-labelledby="ps">
            <h2 className="w-h3" id="ps">{tr('أرقام الطوارئ', 'Emergency numbers')}</h2>
            <SosGrid />
          </section>
          {confirmOut ? (
            <div className="ftc-card p-sec" role="alertdialog" aria-labelledby="out-q">
              <b id="out-q">{tr('تخرج من الحساب؟', 'Sign out?')}</b>
              <div className="w-row">
                <button className="ftc-btn ftc-btn--primary" type="button" onClick={() => void signOut()} data-testid="sign-out-confirm">{tr('أيوه، اخرج', 'Yes, sign out')}</button>
                <button className="ftc-btn ftc-btn--secondary w-neutral" type="button" onClick={() => setConfirmOut(false)}>{tr('لأ', 'No')}</button>
              </div>
            </div>
          ) : (
            <button className="ftc-btn ftc-btn--secondary ftc-btn--block p-out" type="button" onClick={() => setConfirmOut(true)} data-testid="sign-out">
              <Icon name="arrow-forward" size={20} />{tr('خروج', 'Sign out')}
            </button>
          )}
          <p className="p-ver">{tr('CityFix · النسخة ١٫٠', 'CityFix · Version 1.0')}</p>
        </div>
        <aside className="p-side" aria-label={tr('إحصائياتي', 'My stats')}>
          <section className="ftc-card p-sec" aria-labelledby="st">
            <h2 className="w-h3" id="st">{tr('إحصائياتي', 'My stats')}</h2>
            <div className="p-stats">
              <div><b>{localDigits(stats.reports)}</b><span>{tr('بلاغاتك', 'Your reports')}</span></div><i className="sep" />
              <div><b>{localDigits(stats.fixed)}</b><span>{tr('اتصلّحت', 'Fixed')}</span></div>
            </div>
            <div className="p-medal">
              <MedalIcon size={56} />
              <span><span className="cap">{medal.earnedTitle ? tr('لقبك', 'Your title') : tr('في الطريق للقب', 'On the way to a title')}</span><span className="ttl">{medalTitle(medal.title)}</span></span>
            </div>
            <div className="p-next">
              <span>{medal.next ? remainingLine(medal.remaining, medal.next.title) : tr('ده أعلى لقب. شكرًا على مشاركتك في تصليح مدينتك.', "That's the top title. Thank you for helping fix your city.")}</span>
              <span className="ftc-bar" role="progressbar" aria-label={tr('التقدّم للقب الجاي', 'Progress to the next title')} aria-valuemin={0} aria-valuemax={medal.goal} aria-valuenow={Math.min(stats.reports, medal.goal)}>
                <span style={{ width: `${Math.round(medal.progress * 100)}%` }} />
              </span>
            </div>
            <Link className="ftc-btn ftc-btn--secondary ftc-btn--block" href="/requests">{tr('شوف طلباتي', 'View my requests')}</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
