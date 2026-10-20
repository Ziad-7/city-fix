import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Card } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';
import { formatDateTimeAr } from '@/utils/time';
import type { StepState, TimelineStep } from './timeline';

const DOT = 24;

function Dot({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <View style={[styles.dot, { backgroundColor: colors.red }]}>
        <Icon name="check" size={14} color={colors.onRed} strokeWidth={3} />
      </View>
    );
  }
  if (state === 'current') return <View style={[styles.dot, { backgroundColor: colors.gold, borderWidth: 4, borderColor: colors.goldSoft }]} />;
  return <View style={[styles.dot, { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line }]} />;
}

/** "مراحل البلاغ": vertical RTL timeline. Done = red check, current = gold dot with soft ring, future = hollow. */
export function TimelineCard({ title, steps }: { title: string; steps: TimelineStep[] }) {
  return (
    <Card rounded="lg" padding={16} accessibilityLabel={title}>
      <AppText style={styles.heading} accessibilityRole="header">{title}</AppText>
      <View>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const next = steps[i + 1];
          // The rail below a dot is red while the next stage is reached, gold into the current one, grey toward the future.
          const rail = next?.state === 'future' ? colors.line : next?.state === 'current' ? colors.gold : colors.red;
          return (
            <View key={s.key} style={styles.item} accessible accessibilityLabel={`${s.title}${s.at ? `، ${formatDateTimeAr(s.at)}` : ''}`}>
              <View style={styles.rail}>
                <Dot state={s.state} />
                {last ? null : <View style={[styles.line, { backgroundColor: rail }]} />}
              </View>
              <View style={[styles.body, last ? null : styles.bodyGap]}>
                <AppText style={[styles.stepTitle, s.state === 'current' ? { fontFamily: fonts.sans700 } : null, s.state === 'future' ? { fontFamily: fonts.sans500, color: colors.inkMuted } : null]}>
                  {s.title}
                </AppText>
                {s.detail ? <AppText variant="small" color={colors.inkMuted} style={styles.detail}>{s.detail}</AppText> : null}
                {s.at ? <AppText variant="caption" color={colors.inkMuted}>{formatDateTimeAr(s.at)}</AppText> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, marginBottom: 12, color: colors.ink },
  item: { flexDirection: 'row', gap: 12 },
  rail: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, minHeight: 24 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  bodyGap: { paddingBottom: 16 },
  stepTitle: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24 },
  detail: { fontSize: 13, lineHeight: 20 },
});
