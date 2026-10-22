'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatEgp, formatKg, materialLabel } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { useRecycling } from '@/store';
import { DemoPricesNote, MaterialBadge } from '@/ui/citycycle';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';
import { localDigits } from '@/utils/digits';

/** My recycling impact: kilos, by material, pickups. CO₂ only when the backend sends a verified figure. */
export default function ImpactPage() {
  const tr = useTr();
  const router = useRouter();
  usePageTitle(tr('أثري في التدوير', 'My recycling impact'));
  const impact = useRecycling((s) => s.impact);
  const status = useRecycling((s) => s.impactStatus);
  const load = useRecycling((s) => s.loadImpact);
  useEffect(() => {
    void load();
  }, [load]);

  let body: React.ReactNode;
  if (!impact && status !== 'error') {
    body = <StateMessage loading title={tr('بنحسب أثرك…', 'Working out your impact…')} />;
  } else if (!impact) {
    body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل أثرك', "We couldn't load your impact")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void load()} />;
  } else if (impact.pickups === 0) {
    body = (
      <StateMessage icon="leaf" title={tr('لسه مفيش تدوير', 'No recycling yet')} body={tr('أول ما جامع يخلّص أول طلب تدوير هتشوف أثرك هنا.', 'Once a collector completes a request for you, your impact shows up here.')} actionLabel={tr('اطلب جمع تدوير', 'Request a pickup')} onAction={() => router.push('/services/recycling')} />
    );
  } else {
    const max = Math.max(...impact.byMaterial.map((m) => m.kg), 1);
    body = (
      <>
        <div className="cc-impact__hero" data-testid="impact-total">
          <span className="cc-impact__big">{formatKg(impact.totalKg)}</span>
          <span className="w-sub">{tr(`اتدوّروا من ${localDigits(impact.pickups)} طلب`, `recycled across ${impact.pickups} pickups`)}</span>
          {impact.earnedEgp !== undefined ? <span className="cc-impact__earn">{tr('كسبت', 'You earned')} {formatEgp(impact.earnedEgp)}</span> : null}
          {impact.earnedEgp !== undefined ? <DemoPricesNote /> : null}
          {impact.co2AvoidedKg !== undefined ? (
            <span className="cc-impact__co2" data-testid="impact-co2">{tr(`وفّرت حوالي ${localDigits(Math.round(impact.co2AvoidedKg))} كجم انبعاثات كربون`, `About ${Math.round(impact.co2AvoidedKg)} kg of CO₂ avoided`)}</span>
          ) : null}
        </div>
        <section className="cc-impact__list" aria-labelledby="impact-by-material">
          <h2 id="impact-by-material">{tr('حسب الخامة', 'By material')}</h2>
          {impact.byMaterial.map((m) => (
            <div key={m.materialId} className="cc-impact__row">
              <MaterialBadge id={m.materialId} size={32} />
              <div className="cc-impact__main">
                <div className="cc-impact__top"><span>{materialLabel(m.materialId)}</span><span>{formatKg(m.kg)}</span></div>
                <div className="cc-impact__track"><span className="cc-impact__fill" style={{ width: `${Math.max(4, (m.kg / max) * 100)}%` }} /></div>
              </div>
            </div>
          ))}
        </section>
      </>
    );
  }

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head"><div><h1 className="w-h1">{tr('أثري في التدوير', 'My recycling impact')}</h1></div></div>
      <div className="cc-impact">
        {body}
        <Link className="ftc-btn ftc-btn--secondary" href="/recycling-guide"><Icon name="info" size={18} />{tr('دليل الفرز', 'Sorting guide')}</Link>
      </div>
    </main>
  );
}
