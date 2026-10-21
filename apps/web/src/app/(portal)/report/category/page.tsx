import Link from 'next/link';
import { CategoryGrid } from '@/ui/CategoryGrid';
import { EmergencyBox, UtilityCard } from '@/ui/Hotlines';
import { Icon } from '@/ui/Icon';

export default function CategoryPage() {
  return (
    <main className="ftc-web-main" id="main" style={{ maxWidth: 1000 }}>
      <Link className="w-back" href="/"><Icon name="arrow-back" size={18} />الرئيسية</Link>
      <div className="w-page-head">
        <div><h1 className="w-h1">إيه نوع المشكلة؟</h1><p className="w-sub">اختار النوع، وبعدها هتصوّر وتكتب التفاصيل.</p></div>
        <span className="w-step">خطوة ١ من ٣</span>
      </div>
      <div className="w-stepbar" aria-hidden="true"><span className="on" /><span /><span /></div>
      <EmergencyBox />
      <Link className="c-voice w-card-link" href="/report/new?voice=1" style={{ color: '#fff' }}>
        <span className="mic"><Icon name="mic" size={24} /></span>
        <span><b>مش عارف تختار؟ قولها بصوتك</b><span className="s">ابعت فويس نوت بالعامية، وإحنا نفهم المشكلة ونصنّفها</span></span>
        <span className="ftc-btn ftc-btn--gold ftc-btn--sm">سجّل بصوتك</span>
      </Link>
      <section className="w-sec" style={{ marginTop: 24 }} aria-label="أنواع المشاكل">
        <CategoryGrid />
      </section>
      <section className="w-sec" aria-label="المرافق">
        <UtilityCard />
      </section>
    </main>
  );
}
