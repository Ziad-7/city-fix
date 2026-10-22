import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { EmergencyAlert, EmergencyBox } from '@/components/Hotlines';
import { Icon } from '@/components/Icon';
import { AppText, ProgressBar } from '@/components/ui';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { SEVERITY_LABEL_AR, type CategoryId, type TriageSuggestion } from '@/domain/types';
import { labelOfCategory, severityLabel, useIsRTL, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { CategoryTile } from './CategoryTile';
import { Grid3 } from './Grid3';

export type TriageState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  state: TriageState;
  suggestion: TriageSuggestion | null;
  selected: CategoryId | null;
  onSelect: (id: CategoryId) => void;
  onPickOther: () => void;
  onRetry: () => void;
};

/** "اقتراح الذكاء الاصطناعي": severity chip, summary line, top-3 radio options with confidence bars. */
export function AiSuggestion({ state, suggestion, selected, onSelect, onPickOther, onRetry }: Props) {
  const tr = useTr();
  if (state === 'idle') return null;

  if (state === 'error') {
    return (
      <View accessibilityRole="alert" style={styles.card}>
        <AppText variant="smallStrong" color={colors.urgentDeep}>{tr('معرفناش نحلّل البلاغ دلوقتي', "We couldn't analyse your report right now")}</AppText>
        <AppText variant="small">{tr('تقدر تختار التصنيف بنفسك وتكمّل.', 'You can pick the type yourself and continue.')}</AppText>
        <View style={styles.links}>
          <LinkButton label={tr('جرّب تاني', 'Try again')} onPress={onRetry} />
          <LinkButton label={tr('اختار التصنيف بنفسك', 'Choose the type yourself')} onPress={onPickOther} />
        </View>
      </View>
    );
  }

  if (!suggestion) {
    return (
      <View accessibilityLabel={tr('بنحلّل البلاغ', 'Analysing your report')} style={[styles.card, styles.loadingRow]}>
        <ActivityIndicator color={colors.red} />
        <AppText variant="smallStrong" color={colors.redDeep}>{tr('الذكاء الاصطناعي بيحلّل بلاغك...', 'AI is analysing your report...')}</AppText>
      </View>
    );
  }

  const critical = suggestion.severity === 'critical';
  return (
    <View testID="ai-suggestion" accessibilityLabel={tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')} style={styles.card}>
      {suggestion.emergency ? <EmergencyAlert /> : null}
      <View style={styles.head}>
        <View style={styles.title}>
          <Icon name="sparkles" size={18} color={colors.redDeep} />
          <AppText color={colors.redDeep} style={styles.titleText}>{tr('اقتراح الذكاء الاصطناعي', 'AI suggestion')}</AppText>
        </View>
        <View style={[styles.sev, critical ? { backgroundColor: colors.urgent } : null]}>
          <View style={[styles.sevDot, { backgroundColor: critical ? colors.onRed : colors.redDeep }]} />
          <AppText variant="caption" color={critical ? colors.onRed : colors.redDeep} style={{ fontFamily: fonts.sans600 }}>
            {severityLabel(suggestion.severity, SEVERITY_LABEL_AR[suggestion.severity])}
          </AppText>
        </View>
      </View>

      <AppText variant="small">{suggestion.summary}</AppText>
      {suggestion.source === 'fallback' ? (
        <AppText testID="ai-fallback-label" variant="caption" color={colors.inkMuted}>
          {tr('اقتراح محلي من الكلمات، مش نتيجة نموذج ذكاء اصطناعي.', 'Local keyword fallback; no AI model was used.')}
        </AppText>
      ) : null}

      <View accessibilityRole="radiogroup" style={styles.options}>
        <AppText variant="caption" color={colors.inkMuted}>{tr('اختار التصنيف الصح', 'Choose the right type')}</AppText>
        {suggestion.options.map((o) => {
          const on = o.categoryId === selected;
          const pct = Math.round(o.confidence * 100);
          return (
            <Pressable
              key={o.categoryId}
              testID={`ai-option-${o.categoryId}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={tr(`${getCategory(o.categoryId).labelAr}، ${localDigits(pct)} في المية`, `${labelOfCategory(getCategory(o.categoryId))}, ${pct} percent`)}
              onPress={() => onSelect(o.categoryId)}
              style={[styles.option, on ? styles.optionOn : styles.optionOff]}
            >
              <View style={styles.optionTop}>
                <View style={[styles.radio, on ? { borderColor: colors.red } : { borderColor: colors.inkMuted }]}>
                  {on ? <View style={styles.radioDot} /> : null}
                </View>
                <AppText style={[styles.optionLabel, { fontFamily: on ? fonts.sans600 : fonts.sans500 }]}>{labelOfCategory(getCategory(o.categoryId))}</AppText>
                <AppText style={{ fontFamily: on ? fonts.sans700 : fonts.sans600, fontSize: 13 }} color={on ? colors.red : colors.inkMuted}>{localDigits(pct)}{tr('٪', '%')}</AppText>
              </View>
              <ProgressBar value={o.confidence} height={6} color={on ? colors.red : colors.inkMuted} trackColor={on ? colors.redSoft : colors.statusReceivedBg} />
            </Pressable>
          );
        })}
      </View>

      <LinkButton testID="ai-pick-other" label={tr('مش صح؟ اختار التصنيف بنفسك', 'Not right? Choose the type yourself')} onPress={onPickOther} />
    </View>
  );
}

function LinkButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={styles.link}>
      <AppText variant="smallStrong" color={colors.red}>{label}</AppText>
    </Pressable>
  );
}

/** Compact "type" row used before the AI has anything to say (no photo or description yet). */
export function CategoryRow({ selected, onPress }: { selected: CategoryId | null; onPress: () => void }) {
  const tr = useTr();
  const cat = selected ? getCategory(selected) : null;
  return (
    <Pressable
      testID="category-row"
      accessibilityRole="button"
      accessibilityLabel={cat ? tr(`النوع: ${cat.labelAr}. غيّر النوع`, `Type: ${labelOfCategory(cat)}. Change the type`) : tr('اختار نوع المشكلة', 'Choose the type of problem')}
      onPress={onPress}
      style={styles.catRow}
    >
      <View style={styles.catDisc}>
        <Icon name={cat ? cat.icon : 'search'} size={20} color={colors.red} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" color={colors.inkMuted}>{tr('نوع المشكلة', 'Type of problem')}</AppText>
        <AppText variant="smallStrong">{cat ? labelOfCategory(cat) : tr('النوع لسه مش متحدد', 'No type chosen yet')}</AppText>
      </View>
      <AppText variant="smallStrong" color={colors.red}>{cat ? tr('غيّر', 'Change') : tr('اختار', 'Choose')}</AppText>
    </Pressable>
  );
}

/** Bottom sheet with every category, for "مش صح؟ اختار التصنيف بنفسك". */
export function CategoryPicker({ visible, selected, onClose, onSelect }: { visible: boolean; selected: CategoryId | null; onClose: () => void; onSelect: (id: CategoryId) => void }) {
  const tr = useTr();
  const rtl = useIsRTL();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { direction: rtl ? 'rtl' : 'ltr' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('إغلاق', 'Close')} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <AppText accessibilityRole="header" variant="h3" style={{ flex: 1 }}>{tr('اختار نوع المشكلة', 'Choose the type of problem')}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={tr('إغلاق', 'Close')} onPress={onClose} style={styles.close}>
              <Icon name="x" size={20} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetGrid}>
            <EmergencyBox />
            <Grid3>
              {CATEGORIES.map((c) => (
                <CategoryTile key={c.id} category={c} selected={c.id === selected} onPress={() => onSelect(c.id)} />
              ))}
            </Grid3>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.redSoft, borderRadius: radius.lg, padding: 16, gap: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  titleText: { fontFamily: fonts.sans700, fontSize: 13, lineHeight: 20 },
  sev: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surface },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  options: { gap: 8 },
  option: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, gap: 6, minHeight: 44 },
  optionOn: { borderWidth: 2, borderColor: colors.red },
  optionOff: { borderWidth: 1, borderColor: colors.line },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionLabel: { flex: 1, fontSize: 15, lineHeight: 24 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  links: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, minHeight: 60 },
  catDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,22,22,0.45)' },
  sheet: { maxHeight: '80%', backgroundColor: colors.paper, borderTopStartRadius: 28, borderTopEndRadius: 28, paddingTop: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetGrid: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
});
