'use client';

import Link from 'next/link';
import { useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { CategoryGrid } from '@/ui/CategoryGrid';
import { EmergencyBox, UtilityCard } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';

export default function CategoryPage() {
  const tr = useTr();
  usePageTitle(tr('نوع المشكلة', 'Type of problem'));
  return (
    <main className="ftc-web-main" id="main" style={{ maxWidth: 1000 }}>
      <Link className="w-back" href="/"><Icon name="arrow-back" size={18} />{tr('الرئيسية', 'Home')}</Link>
      <div className="w-page-head">
        <div><h1 className="w-h1">{tr('إيه نوع المشكلة؟', 'What’s the problem?')}</h1><p className="w-sub">{tr('اختار النوع، وبعدها هتصوّر وتكتب التفاصيل.', 'Pick the type, then add a photo and a few details.')}</p></div>
        <span className="w-step">{tr('خطوة ١ من ٣', 'Step 1 of 3')}</span>
      </div>
      <div className="w-stepbar" aria-hidden="true"><span className="on" /><span /><span /></div>
      <EmergencyBox />
      <Link className="c-voice w-card-link" href="/report/new?voice=1" style={{ color: '#fff' }}>
        <span className="mic"><Icon name="mic" size={24} /></span>
        <span><b>{tr('مش عارف تختار؟ قولها بصوتك', 'Not sure which? Tell us with your voice')}</b><span className="s">{tr('ابعت فويس نوت بالعامية، وإحنا نفهم المشكلة ونصنّفها', 'Send a voice note in your own words, and we’ll work out what the problem is')}</span></span>
        <span className="ftc-btn ftc-btn--gold ftc-btn--sm">{tr('سجّل بصوتك', 'Record a voice note')}</span>
      </Link>
      <section className="w-sec" style={{ marginTop: 24 }} aria-label={tr('أنواع المشاكل', 'Problem types')}>
        <CategoryGrid />
      </section>
      <section className="w-sec" aria-label={tr('المرافق', 'Utilities')}>
        <UtilityCard />
      </section>
    </main>
  );
}
