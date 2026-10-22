import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import type { WasteClassification } from '@/domain/citycycle';
import { materialLabel, useTr, wasteSizeLabel } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatKg } from '@/utils/money';
import { hasSuggestion, suggestionKg } from './form';

export type SuggestionState = 'idle' | 'loading' | 'ready';

type Props = { state: SuggestionState; result: WasteClassification | null; applied: boolean; onApply: () => void };

/**
 * "اقتراح الذكاء الاصطناعي": what the photo check found (material, size, weight). Tapping applies it to the form;
 * it is never applied by itself, and the person can ignore it and choose by hand.
 */
export function WasteSuggestion({ state, result, applied, onApply }: Props) {
  const tr = useTr();
  if (state === 'idle') return null;

  if (state === 'loading') {
    return (
      <View style={[styles.card, styles.loading]} accessibilityLiveRegion="polite" accessibilityLabel={tr('الذكاء الاصطناعي بيبص على الصورة', 'AI is looking at the photo')}>
        <ActivityIndicator color={colors.red} />
        <AppText variant="smallStrong" color={colors.redDeep}>{tr('الذكاء الاصطناعي بيبص على الصورة…', 'AI is looking at the photo…')}</AppText>
      </View>
    );
  }

  if (!hasSuggestion(result)) {
    return (
      <View testID="waste-suggestion" style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.title}>
          <Icon name="sparkles" size={18} color={colors.redDeep} />
          <AppText color={colors.redDeep} style={styles.titleText}>{tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')}</AppText>
        </View>
        <AppText variant="small">{tr('مقدرناش نتعرف على الخامة من الصورة. اختار بنفسك من فوق.', "We couldn't tell the material from the photo. Choose it yourself above.")}</AppText>
      </View>
    );
  }

  const top = result.materials[0].materialId;
  const kg = suggestionKg(result);
  const line = tr(
    `شكلها ${materialLabel(top)}، حجم ${wasteSizeLabel(result.size)}، حوالي ${formatKg(kg)}`,
    `Looks like ${materialLabel(top)}, ${wasteSizeLabel(result.size).toLowerCase()} size, about ${formatKg(kg)}`,
  );
  return (
    <Pressable
      testID="waste-suggestion"
      accessibilityRole="button"
      accessibilityLabel={`${tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')}. ${line}`}
      accessibilityHint={tr('اضغط عشان تستخدم الاقتراح', 'Tap to use the suggestion')}
      onPress={onApply}
      disabled={applied}
      style={({ pressed }) => [styles.card, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={styles.title}>
        <Icon name="sparkles" size={18} color={colors.redDeep} />
        <AppText color={colors.redDeep} style={styles.titleText}>{tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')}</AppText>
      </View>
      <AppText variant="small">{line}</AppText>
      {applied ? (
        <View style={styles.applied}>
          <Icon name="check" size={16} color={colors.statusResolved} strokeWidth={3} />
          <AppText variant="caption" color={colors.statusResolved} style={{ fontFamily: fonts.sans600 }}>{tr('اتضاف للطلب. تقدر تعدّله.', 'Added to your request. You can change it.')}</AppText>
        </View>
      ) : (
        <AppText variant="caption" color={colors.redDeep} style={{ fontFamily: fonts.sans600 }}>{tr('اضغط هنا عشان تستخدمه، أو اختار بنفسك', 'Tap here to use it, or choose yourself')}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.redSoft, borderRadius: radius.md, padding: 12, gap: 6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { fontFamily: fonts.display600, fontSize: 15, lineHeight: 22 },
  applied: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
