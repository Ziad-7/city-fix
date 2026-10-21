import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';
import { useTr } from '@/i18n';

export default function TabsLayout() {
  const tr = useTr();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: tr('الرئيسية', 'Home') }} />
      <Tabs.Screen name="map" options={{ title: tr('الخريطة', 'Map') }} />
      <Tabs.Screen name="requests" options={{ title: tr('طلباتي', 'My requests') }} />
      <Tabs.Screen name="profile" options={{ title: tr('حسابي', 'Account') }} />
    </Tabs>
  );
}
