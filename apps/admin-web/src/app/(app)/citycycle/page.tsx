'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Notice, PageHead } from '@/components/ui';
import {
  BinAlertsSection,
  CollectorsSection,
  ImpactSection,
  PayoutsSection,
  PickupsSection,
  PricesSection,
} from '@/components/citycycle/sections';
import { RoutesSection } from '@/components/citycycle/RoutePlanner';
import { isCityCycleDemo, subscribeCityCycleDemo } from '@/services/citycycle';
import { useSession } from '@/lib/session';

const TABS = [
  { id: 'pickups', label: 'الطلبات' },
  { id: 'collectors', label: 'الجامعون' },
  { id: 'prices', label: 'الأسعار' },
  { id: 'routes', label: 'مسارات الجمع' },
  { id: 'payouts', label: 'مستحقات الجامعين' },
  { id: 'bins', label: 'تنبيهات الحاويات' },
  { id: 'impact', label: 'الأثر' },
] as const;

export default function CityCyclePage() {
  const session = useSession();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('pickups');
  const isAdmin = session?.role === 'admin';
  // Route planning is admin-only on the server, so staff never see the tab.
  const tabs = TABS.filter((t) => t.id !== 'routes' || isAdmin);
  const demo = useSyncExternalStore(subscribeCityCycleDemo, isCityCycleDemo, () => false);

  useEffect(() => {
    document.title = 'CityFix — مركز القيادة: إعادة التدوير';
  }, []);

  return (
    <main>
      <PageHead title="إعادة التدوير" subtitle="طلبات الجمع ومسارات الجمع والجامعون ومستحقاتهم وقائمة الأسعار وتنبيهات الحاويات وأثر البرنامج." />
      {demo && (
        <Notice tone="gold" className="mb-3">
          السيرفر لسه مفعّلش مسارات إعادة التدوير، فالبيانات هنا تجريبية.
        </Notice>
      )}
      <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {tabs.map((t) => (
          <Button key={t.id} role="tab" aria-selected={tab === t.id} size="sm" variant={tab === t.id ? 'primary' : 'secondary'} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      {tab === 'pickups' && <PickupsSection isAdmin={isAdmin} />}
      {tab === 'collectors' && <CollectorsSection isAdmin={isAdmin} />}
      {tab === 'prices' && <PricesSection isAdmin={isAdmin} />}
      {tab === 'routes' && isAdmin && <RoutesSection />}
      {tab === 'payouts' && <PayoutsSection />}
      {tab === 'bins' && <BinAlertsSection />}
      {tab === 'impact' && <ImpactSection />}
    </main>
  );
}
