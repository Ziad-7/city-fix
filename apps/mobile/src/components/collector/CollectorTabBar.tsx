import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import type { IconName } from '@/domain/types';
import { useTr } from '@/i18n';
import { colors, fonts, layout, radius } from '@/theme/tokens';
import { AppText } from '../ui/AppText';
import { Icon } from '../Icon';

export const COLLECTOR_TABS: Record<string, { ar: string; en: string; icon: IconName }> = {
  index: { ar: 'الشغل', en: 'Jobs', icon: 'truck' },
  map: { ar: 'الخريطة', en: 'Map', icon: 'map' },
  earnings: { ar: 'الأرباح', en: 'Earnings', icon: 'banknote' },
  account: { ar: 'حسابي', en: 'Account', icon: 'user' },
};

/** The collector's own bottom bar: four big targets, dark bar with a gold active pill (high contrast, readable in sunlight). */
export function CollectorTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const tr = useTr();
  const focused = state.routes[state.index]?.name;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
      {state.routes.map((route) => {
        const meta = COLLECTOR_TABS[route.name];
        if (!meta) return null;
        const active = focused === route.name;
        const label = tr(meta.ar, meta.en);
        const fg = active ? colors.ink : colors.onRed;
        return (
          <Pressable
            key={route.key}
            testID={`ctab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={styles.slot}
          >
            <View style={[styles.pill, active ? styles.pillOn : null]}>
              <Icon name={meta.icon} size={24} color={fg} strokeWidth={2} />
              <AppText fixedSize numberOfLines={1} maxFontSizeMultiplier={1.2} color={fg} style={{ fontFamily: active ? fonts.sans700 : fonts.sans600, fontSize: 13, lineHeight: 18 }}>{label}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.ink, paddingTop: 6, minHeight: layout.tabBarHeight },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: 56, minWidth: 72, paddingHorizontal: 10, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pillOn: { backgroundColor: colors.gold },
});
