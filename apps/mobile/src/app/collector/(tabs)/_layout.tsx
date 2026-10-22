import { Tabs } from 'expo-router/js-tabs';
import { CollectorTabBar } from '@/components/collector';
import { useTr } from '@/i18n';

/** الشغل · الخريطة · الأرباح · حسابي */
export default function CollectorTabsLayout() {
  const tr = useTr();
  return (
    <Tabs tabBar={(props) => <CollectorTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: tr('الشغل', 'Jobs') }} />
      <Tabs.Screen name="map" options={{ title: tr('الخريطة', 'Map') }} />
      <Tabs.Screen name="earnings" options={{ title: tr('الأرباح', 'Earnings') }} />
      <Tabs.Screen name="account" options={{ title: tr('حسابي', 'Account') }} />
    </Tabs>
  );
}
