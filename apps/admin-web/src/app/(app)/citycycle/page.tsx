'use client';

import { useEffect, useState } from 'react';
import { Button, Notice, PageHead } from '@/components/ui';
import {
  BinAlertsSection,
  CollectorsSection,
  ImpactSection,
  PickupsSection,
  PricesSection,
} from '@/components/citycycle/sections';
import { isCityCycleDemo } from '@/services/citycycle';
import { useSession } from '@/lib/session';

const TABS = [
  { id: 'pickups', label: 'الطلبات' },
  { id: 'collectors', label: 'الجامعون' },
  { id: 'prices', label: 'الأسعار' },
  { id: 'bins', label: 'تنبيهات الحاويات' },
  { id: 'impact', label: 'الأثر' },
] as const;

export default function CityCyclePage() {
  const session = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('pickups');
  const [, bump] = useState(0);

  useEffect(() => {
    document.title = 'CityFix — مركز القيادة: إعادة التدوير';
    const t = setInterval(() => bump((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <main>
      <PageHead title="إعادة التدوير" subtitle="طلبات الجمع والجامعون وقائمة الأسعار وتنبيهات الحاويات وأثر البرنامج." />
      {isCityCycleDemo() && (
        <Notice tone="gold" className="mb-3">
          السيرفر لسه مفعّلش مسارات إعادة التدوير، فالبيانات هنا تجريبية.
        </Notice>
      )}
      <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {TABS.map((t) => (
          <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? 'primary' : 'secondary'} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      {tab === 'pickups' && <PickupsSection />}
      {tab === 'collectors' && <CollectorsSection />}
      {tab === 'prices' && <PricesSection isAdmin={session?.role === 'admin'} />}
      {tab === 'bins' && <BinAlertsSection />}
      {tab === 'impact' && <ImpactSection />}
    </main>
  );
}
