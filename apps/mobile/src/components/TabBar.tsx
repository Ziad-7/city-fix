import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import type { IconName } from '@/domain/types';
import { useTr } from '@/i18n';
import { colors, fonts, layout, shadows } from '@/theme/tokens';
import { AppText } from './ui/AppText';
import { Icon } from './Icon';

export const TABS: Record<string, { ar: string; en: string; icon: IconName }> = {
  index: { ar: 'الرئيسية', en: 'Home', icon: 'home' },
  map: { ar: 'الخريطة', en: 'Map', icon: 'map' },
  requests: { ar: 'طلباتي', en: 'My requests', icon: 'clipboard' },
  profile: { ar: 'حسابي', en: 'Account', icon: 'user' },
};

/**
 * Bottom nav from Main.html: الرئيسية · الخريطة · [gold Report FAB] · طلباتي · حسابي.
 * Rows mirror automatically in RTL, so slots are listed in reading order. English: Home · Map · Report · My requests · Account.
 */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const tr = useTr();
  const focused = state.routes[state.index]?.name;

  const renderTab = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    const meta = TABS[name];
    if (!route || !meta) return null;
    const active = focused === name;
    const label = tr(meta.ar, meta.en);
    const color = active ? colors.red : colors.inkMuted;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={() => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !e.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        style={styles.slot}
      >
        <Icon name={meta.icon} size={22} color={color} />
        <AppText fixedSize numberOfLines={1} maxFontSizeMultiplier={1.2} color={color} style={{ fontFamily: active ? fonts.sans600 : fonts.sans500, fontSize: 11, lineHeight: 16 }}>{label}</AppText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { height: layout.tabBarHeight + insets.bottom, paddingBottom: insets.bottom }]}>
      {renderTab('index')}
      {renderTab('map')}
      <View style={styles.slot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('بلّغ عن مشكلة', 'Report a problem')}
          testID="report-fab"
          onPress={() => router.push('/report/category')}
          style={({ pressed }) => [styles.fab, pressed ? { opacity: 0.85 } : null]}
        >
          <Icon name="camera" size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>
      {renderTab('requests')}
      {renderTab('profile')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line, overflow: 'visible' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  fab: { width: 60, height: 60, marginTop: -34, borderRadius: 30, backgroundColor: colors.gold, borderWidth: 4, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', ...shadows.float },
});
