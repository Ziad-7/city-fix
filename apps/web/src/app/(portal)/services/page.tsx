'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SERVICES, SERVICE_GROUPS, type ServiceGroup } from '@/domain/services-catalog';
import { filterServices } from '@/components/services/filter';
import type { IconName } from '@/domain/types';
import { serviceGroupLabel, serviceSubtitle, serviceTitle, useTr } from '@/i18n';
import { Pills } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';
import { usePageTitle } from '@/lib/usePageTitle';

const CITYCYCLE_ENTRIES: { href: '/services/recycling' | '/recycling-guide' | '/impact'; icon: IconName; ar: string; en: string; subAr: string; subEn: string; testId: string }[] = [
  { href: '/services/recycling', icon: 'recycle', ar: 'جمع تدوير من بيتك', en: 'Recycling pickup', subAr: 'جامع موثّق ياخد الخامات ويوزنها', subEn: 'A verified collector takes and weighs your materials', testId: 'service-recycling' },
  { href: '/recycling-guide', icon: 'info', ar: 'دليل الفرز', en: 'Sorting guide', subAr: 'إيه اللي يتدوّر وإيه اللي لأ', subEn: 'What can be recycled and what cannot', testId: 'service-guide' },
  { href: '/impact', icon: 'leaf', ar: 'أثري في التدوير', en: 'My recycling impact', subAr: 'كام كيلو دوّرت', subEn: 'How many kilos you have recycled', testId: 'service-impact' },
];

export default function ServicesPage() {
  const tr = useTr();
  usePageTitle(tr('خدمات المدينة', 'City services'));
  const [group, setGroup] = useState<ServiceGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const list = useMemo(() => filterServices(SERVICES, query, group), [query, group]);

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head"><div><h1 className="w-h1">{tr('خدمات المدينة', 'City services')}</h1><p className="w-sub">{tr('اطلب خدمة من الحي واحجز ميعاد يناسبك.', 'Request a district service and book a time that suits you.')}</p></div></div>
      <div className="v-tools">
        <Pills options={SERVICE_GROUPS.map((g) => ({ id: g.id, labelAr: serviceGroupLabel(g) }))} value={group} onChange={setGroup} label={tr('نوع الخدمة', 'Service type')} />
        <div className="v-search">
          <label className="w-sr" htmlFor="q">{tr('ابحث عن خدمة', 'Search services')}</label>
          <Icon name="search" size={20} />
          <input className="ftc-input" id="q" type="search" placeholder={tr('ابحث عن خدمة…', 'Search services…')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {query.trim() === '' && group === 'all' ? (
        <section className="v-cc" aria-labelledby="cc-h">
          <h2 className="w-h3" id="cc-h">{tr('سيتي سايكل · تدوير', 'CityCycle · Recycling')}</h2>
          <div className="v-cat">
            {CITYCYCLE_ENTRIES.map((e) => (
              <Link key={e.href} className="ftc-tile v-card" href={e.href} data-testid={e.testId}>
                <span className="ftc-icon-well"><Icon name={e.icon} size={24} /></span>
                <h3>{tr(e.ar, e.en)}</h3>
                <p>{tr(e.subAr, e.subEn)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {list.length === 0 ? (
        <StateMessage icon="search" title={tr('مش لاقيين خدمة بالاسم ده', 'No service with that name')} body={tr('جرّب كلمة تانية أو شيل الفلتر.', 'Try another word, or clear the filter.')} />
      ) : (
        <section className="v-cat" aria-label={tr('الخدمات', 'Services')}>
          {list.map((s) =>
            s.route ? (
              <Link key={s.id} className="ftc-tile v-card" href={s.route} data-testid={`service-${s.id}`}>
                <span className="ftc-icon-well"><Icon name={s.icon} size={24} /></span>
                <h2>{serviceTitle(s)}</h2>
                <p>{serviceSubtitle(s)}</p>
                <span className="ftc-btn ftc-btn--primary ftc-btn--sm" style={{ alignSelf: 'flex-start' }}>
                  {s.serviceType ? <><Icon name="calendar" size={18} />{tr('احجز دلوقتي', 'Book now')}</> : <><Icon name="clock" size={18} />{tr('شوف المواعيد', 'See the times')}</>}
                </span>
              </Link>
            ) : (
              <div key={s.id} className="ftc-tile v-card" aria-label={`${serviceTitle(s)}${tr('، ', ', ')}${tr('قريبًا', 'Coming soon')}`}>
                <span className="ftc-icon-well"><Icon name={s.icon} size={24} /></span>
                <h2>{serviceTitle(s)}</h2>
                <p>{serviceSubtitle(s)}</p>
                <span className="soon">{tr('قريبًا', 'Coming soon')}</span>
              </div>
            ),
          )}
        </section>
      )}
      <p className="v-fee">{tr('الرسوم بتتحدد حسب لائحة كل حي.', 'Fees follow each district’s rates.')}</p>
    </main>
  );
}
