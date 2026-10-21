import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة' }} />
      <Tabs.Screen name="requests" options={{ title: 'طلباتي' }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي' }} />
    </Tabs>
  );
}
