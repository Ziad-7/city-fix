import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { MaterialBadge } from '@/components/citycycle';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { MATERIAL_IDS, materialDo, materialDont, materialLabel } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';

/** Sorting guide: for each material, what to put out and what to keep out. */
export default function RecyclingGuideScreen() {
  const tr = useTr();
  return (
    <Screen header={<ScreenHeader title={tr('دليل الفرز', 'Sorting guide')} />} gap={12} contentStyle={styles.content}>
      <AppText variant="small" color={colors.inkMuted}>
        {tr('الفرز الصح بيزوّد سعر خاماتك وبيسهّل على الجامع.', 'Sorting well raises the value of your materials and makes the collector’s job easier.')}
      </AppText>
      {MATERIAL_IDS.map((id) => (
        <Card key={id} padding={14} style={styles.card} testID={`guide-${id}`}>
          <View style={styles.head}>
            <MaterialBadge id={id} size={44} on />
            <AppText style={styles.name} accessibilityRole="header">{materialLabel(id)}</AppText>
          </View>
          <View style={styles.line}>
            <Icon name="check" size={16} color={colors.statusResolved} />
            <AppText variant="small" style={styles.text}>{materialDo(id)}</AppText>
          </View>
          <View style={styles.line}>
            <Icon name="x" size={16} color={colors.urgent} />
            <AppText variant="small" style={styles.text}>{materialDont(id)}</AppText>
          </View>
        </Card>
      ))}
      <Button label={tr('اطلب جمع تدوير', 'Request a pickup')} icon="recycle" onPress={() => router.push('/services/recycling')} testID="guide-request" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  text: { flex: 1 },
});
