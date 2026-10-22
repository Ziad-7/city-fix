import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { MaterialGuideCard } from '@/components/recycle';
import { AppText, Button, Screen, ScreenHeader } from '@/components/ui';
import { MATERIALS } from '@/domain/materials';
import { useTr } from '@/i18n';
import { colors } from '@/theme/tokens';

/** دليل الفرز بالصور: one picture card per material, short words, a do and a don't. */
export default function SortingGuideScreen() {
  const tr = useTr();
  return (
    <Screen header={<ScreenHeader title={tr('دليل الفرز بالصور', 'Picture guide to sorting')} />} gap={14} contentStyle={styles.content}>
      <AppText variant="small" color={colors.inkMuted}>
        {tr('الخامات النضيفة والناشفة بتتقبل أسرع وبتتدفع أحسن.', 'Clean, dry materials are accepted faster and earn more.')}
      </AppText>
      {MATERIALS.map((m) => (
        <MaterialGuideCard key={m.id} id={m.id} />
      ))}
      <Button testID="guide-start" label={tr('اطلب استلام خامات', 'Request a pickup')} icon="recycle" onPress={() => router.replace('/recycle/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
});
