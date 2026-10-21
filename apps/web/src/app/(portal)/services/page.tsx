'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SERVICES, SERVICE_GROUPS, type ServiceGroup } from '@/domain/services-catalog';
import { filterServices } from '@/components/services/filter';
import { Pills } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { StateMessage } from '@/ui/StateMessage';

export default function ServicesPage() {
  const [group, setGroup] = useState<ServiceGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const list = useMemo(() => filterServices(SERVICES, query, group), [query, group]);

  return (
    <main className="ftc-web-main" id="main">
      <div className="w-page-head"><div><h1 className="w-h1">خدمات المدينة</h1><p className="w-sub">اطلب خدمة من الحي واحجز ميعاد يناسبك.</p></div></div>
      <div className="v-tools">
        <Pills options={SERVICE_GROUPS} value={group} onChange={setGroup} label="نوع الخدمة" />
        <div className="v-search">
          <label className="w-sr" htmlFor="q">ابحث عن خدمة</label>
          <Icon name="search" size={20} />
          <input className="ftc-input" id="q" type="search" placeholder="ابحث عن خدمة…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {list.length === 0 ? (
        <StateMessage icon="search" title="مش لاقيين خدمة بالاسم ده" body="جرّب كلمة تانية أو شيل الفلتر." />
      ) : (
        <section className="v-cat" aria-label="الخدمات">
          {list.map((s) =>
            s.route ? (
              <Link key={s.id} className="ftc-tile v-card" href={s.route} data-testid={`service-${s.id}`}>
                <span className="ftc-icon-well"><Icon name={s.icon} size={24} /></span>
                <h3>{s.titleAr}</h3>
                <p>{s.subtitleAr}</p>
                <span className="ftc-btn ftc-btn--primary ftc-btn--sm" style={{ alignSelf: 'flex-start' }}><Icon name="calendar" size={18} />احجز دلوقتي</span>
              </Link>
            ) : (
              <div key={s.id} className="ftc-tile v-card" aria-label={`${s.titleAr}، قريبًا`}>
                <span className="ftc-icon-well"><Icon name={s.icon} size={24} /></span>
                <h3>{s.titleAr}</h3>
                <p>{s.subtitleAr}</p>
                <span className="soon">قريبًا</span>
              </div>
            ),
          )}
        </section>
      )}
      <p className="v-fee">الرسوم بتتحدد حسب لائحة كل حي.</p>
    </main>
  );
}
