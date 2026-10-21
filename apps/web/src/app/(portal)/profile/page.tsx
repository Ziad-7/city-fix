'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GOVERNORATES, findGovernorate } from '@/domain/locations';
import { medalFor, remainingLine } from '@/domain/medals';
import { isOpenStatus } from '@/domain/types';
import { signOutAll, useReports, useSession } from '@/store';
import { maskPhone, toArabicDigits } from '@/utils/digits';
import { MedalIcon } from '@/ui/brand';
import { SelectField, ToggleRow } from '@/ui/controls';
import { SosGrid } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';

export default function ProfilePage() {
  const router = useRouter();
  const { phone, name, governorate, district, prefs, setArea, setPrefs, setName } = useSession();
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);

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
      <div className="w-page-head"><div><h1 className="w-h1">حسابي</h1><p className="w-sub">بياناتك، منطقتك، وإعدادات التحديثات.</p></div></div>
      <div className="p-grid">
        <div className="p-main">
          <section className="ftc-card p-sec" aria-labelledby="pa">
            <div className="p-id">
              <span className="p-av" role="img" aria-label="صورة الحساب">{initial ? <b className="a-initial">{initial}</b> : <Icon name="user" size={34} />}</span>
              <span><b id="pa">{name || 'من غير اسم'}</b><span dir="ltr"><bdi>{masked}</bdi></span></span>
            </div>
            <form className="p-namerow" onSubmit={(e) => { e.preventDefault(); if (dirty) saveName(); }}>
              <div className="ftc-field"><label className="ftc-label" htmlFor="nm">الاسم</label><input className="ftc-input" id="nm" data-testid="name-input" value={draft} placeholder="اسمك (اختياري)" onChange={(e) => setDraft(e.target.value)} /></div>
              <button className="ftc-btn ftc-btn--secondary" type="submit" style={{ height: 48 }} disabled={!dirty} data-testid="name-save">حفظ</button>
            </form>
            {saved ? <span className="ftc-caption" style={{ color: 'var(--ftc-status-resolved)' }} role="status">اتحفظ الاسم</span> : null}
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pz">
            <h2 className="w-h3" id="pz">منطقتك</h2>
            <div className="p-pair">
              <SelectField id="g" label="المحافظة" value={governorate} onChange={(g) => setArea(g, findGovernorate(g)?.districts[0]?.nameAr ?? district)} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: g.nameAr }))} />
              <SelectField id="d" label="الحي" value={district} onChange={(d) => setArea(governorate, d)} options={districts.map((d) => ({ value: d.nameAr, label: d.nameAr }))} />
            </div>
          </section>
          <section className="ftc-card p-sec" aria-labelledby="pp">
            <h2 className="w-h3" id="pp">التحديثات والإعدادات</h2>
            <ToggleRow icon="whatsapp" title="تحديثات واتساب" subtitle={<>على رقم <bdi dir="ltr">{masked}</bdi> — ولو مفيش نت هتوصلك SMS</>} on={prefs.whatsappUpdates} onChange={(v) => setPrefs({ whatsappUpdates: v })} />
            <ToggleRow icon="wifi" title="توفير البيانات" subtitle="صور أخف، والخريطة بتتحمّل لما تطلبها" on={prefs.dataSaver} onChange={(v) => setPrefs({ dataSaver: v })} />
            <div className="p-lang"><span>اللغة</span><span>English — قريبًا</span></div>
          </section>
          <section className="ftc-card p-sec" aria-labelledby="ps">
            <h2 className="w-h3" id="ps">أرقام الطوارئ</h2>
            <SosGrid />
          </section>
          {confirmOut ? (
            <div className="ftc-card p-sec" role="alertdialog" aria-labelledby="out-q">
              <b id="out-q">متأكد إنك عايز تخرج؟</b>
              <div className="w-row">
                <button className="ftc-btn ftc-btn--primary" type="button" onClick={() => void signOut()} data-testid="sign-out-confirm">أيوه، اخرج</button>
                <button className="ftc-btn ftc-btn--secondary w-neutral" type="button" onClick={() => setConfirmOut(false)}>لأ</button>
              </div>
            </div>
          ) : (
            <button className="ftc-btn ftc-btn--secondary ftc-btn--block p-out" type="button" onClick={() => setConfirmOut(true)} data-testid="sign-out">
              <Icon name="arrow-forward" size={20} />خروج
            </button>
          )}
          <p className="p-ver">CityFix · النسخة ١٫٠</p>
        </div>
        <aside className="p-side" aria-label="إحصائياتي">
          <section className="ftc-card p-sec" aria-labelledby="st">
            <h2 className="w-h3" id="st">إحصائياتي</h2>
            <div className="p-stats">
              <div><b>{toArabicDigits(stats.reports)}</b><span>بلاغاتك</span></div><i className="sep" />
              <div><b>{toArabicDigits(stats.fixed)}</b><span>اتصلّحت</span></div>
            </div>
            <div className="p-medal">
              <MedalIcon size={56} />
              <span><span className="cap">{medal.earnedTitle ? 'لقبك' : 'في الطريق للقب'}</span><span className="ttl">{medal.title}</span></span>
            </div>
            <div className="p-next">
              <span>{medal.next ? remainingLine(medal.remaining, medal.next.title) : 'وصلت لأعلى لقب. شكرًا إنك بتصلّح مدينتك.'}</span>
              <span className="ftc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={medal.goal} aria-valuenow={Math.min(stats.reports, medal.goal)}>
                <span style={{ width: `${Math.round(medal.progress * 100)}%` }} />
              </span>
            </div>
            <Link className="ftc-btn ftc-btn--secondary ftc-btn--block" href="/requests">شوف طلباتي</Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
