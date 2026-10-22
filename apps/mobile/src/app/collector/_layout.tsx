import { Stack } from 'expo-router';
import { useCollectorSync } from '@/components/collector';
import { colors } from '@/theme/tokens';

/** Collector mode (CityCycle): the collector tabs, and the job flow on top of them. Only reachable in collector mode (see the root layout). */
export default function CollectorLayout() {
  useCollectorSync(true);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[id]" />
    </Stack>
  );
}
