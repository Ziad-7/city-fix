import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { EmergencyBox, UtilityHotlines } from '@/components';
import { Icon } from '@/components/Icon';
import { Grid3 } from '@/components/report/Grid3';
import { CategoryTile } from '@/components/report/CategoryTile';
import { AppText, Screen, ScreenHeader } from '@/components/ui';
import { CATEGORIES } from '@/domain/categories';
import { colors, fonts, radius } from '@/theme/tokens';

export default function CategoryScreen() {
  return (
    <Screen header={<ScreenHeader title="إيه نوع المشكلة؟" step="خطوة ١ من ٣" />} gap={16} contentStyle={{ paddingTop: 4 }}>
      <EmergencyBox />

      <View accessibilityLabel="أنواع المشاكل">
        <Grid3>
          {CATEGORIES.map((c) => (
            <CategoryTile key={c.id} category={c} onPress={() => router.push(`/report/new?category=${c.id}`)} />
          ))}
        </Grid3>
      </View>

      <Pressable
        testID="voice-entry"
        accessibilityRole="button"
        accessibilityLabel="مش عارف تختار؟ قولها بصوتك"
        onPress={() => router.push('/report/new?voice=1')}
        style={({ pressed }) => [styles.voice, pressed ? { opacity: 0.9 } : null]}
      >
        <View style={styles.voiceIcon}>
          <Icon name="mic" size={22} color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText color={colors.onRed} style={styles.voiceTitle}>مش عارف تختار؟ قولها بصوتك</AppText>
          <AppText variant="caption" color={colors.redSoft}>ابعت فويس نوت بالعامية، وإحنا نفهم المشكلة ونصنّفها</AppText>
        </View>
      </Pressable>

      <UtilityHotlines />
    </Screen>
  );
}

const styles = StyleSheet.create({
  voice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.red, borderRadius: radius.md, padding: 14 },
  voiceIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  voiceTitle: { fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 },
});
