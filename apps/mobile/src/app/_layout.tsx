import {
  ArefRuqaa_700Bold,
} from '@expo-google-fonts/aref-ruqaa';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold } from '@expo-google-fonts/readex-pro';
import { useFonts as useExpoFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { OutboxToast } from '@/components/OutboxToast';
import { refreshAll, useIsSignedIn, useOutboxSync, useSessionHydrated } from '@/store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts();
  const hydrated = useSessionHydrated();
  const signedIn = useIsSignedIn();
  const ready = (fontsLoaded || !!fontError) && hydrated;

  // Web preview only: on native, RTL comes from the root `direction: 'rtl'` style below (see README).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.body.style.backgroundColor = colors.paper;
    }
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (ready && signedIn) void refreshAll();
  }, [ready, signedIn]);

  useOutboxSync(ready && signedIn);

  if (!ready) return null;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="report/category" />
          <Stack.Screen name="report/new" />
          <Stack.Screen name="report/success" options={{ gestureEnabled: false }} />
          <Stack.Screen name="requests/[id]" />
          <Stack.Screen name="services/index" />
          <Stack.Screen name="services/bulky-waste" />
        </Stack.Protected>
      </Stack>
      <OutboxToast />
    </View>
  );
}

function useFonts() {
  return useExpoFonts({
    ReadexPro_500Medium,
    ReadexPro_600SemiBold,
    ReadexPro_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    ArefRuqaa_700Bold,
  });
}

// direction: 'rtl' lays the whole app out right-to-left even in Expo Go, which ignores the
// expo-localization forcesRTL plugin. RN's docs tag the prop `@platform ios`, but on Android Fabric applies it too:
// `direction` is in the shared view config, YogaStylableProps.cpp feeds it to Yoga, the resolved direction reaches
// SurfaceMountingManager.updateLayout (View.setLayoutDirection) and ParagraphShadowNode (text alignment). On wide web windows keep the phone-sized column centred.
const styles = StyleSheet.create({
  root: { flex: 1, direction: 'rtl', backgroundColor: colors.paper, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center' },
});
