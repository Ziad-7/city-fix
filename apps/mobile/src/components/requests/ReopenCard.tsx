import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { IncidentStatus } from '@/domain/types';
import { AppText, Button, Card, InlineNotice, TextField } from '@/components/ui';
import { useTr } from '@/i18n';
import { reopenReport } from '@/store/actions';
import { colors, fonts } from '@/theme/tokens';

/** "لسه المشكلة موجودة؟" on a resolved report: a short note and "افتح البلاغ تاني". Self-contained (uses the reports store). */
export function ReopenCard({ incidentId, status }: { incidentId: string; status: IncidentStatus }) {
  const tr = useTr();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reopenReport(incidentId, note.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('معرفناش نفتح البلاغ، جرّب تاني', "We couldn't reopen the report. Try again"));
    } finally {
      setBusy(false);
    }
  };

  // Mounted for every report; shown for a resolved one, and stays (as the confirmation) after it was reopened.
  if (!done && status !== 'resolved') return null;
  if (done) {
    return <InlineNotice testID="reopen-done" text={tr('اتفتح البلاغ تاني، وهنراجعه ونبلّغك بأي جديد.', "The report is open again. We'll review it and keep you posted.")} />;
  }

  return (
    <Card rounded="lg" padding={16} style={styles.card} testID="reopen-card">
      <AppText style={styles.heading} accessibilityRole="header">{tr('لسه المشكلة موجودة؟', 'Still a problem?')}</AppText>
      <AppText variant="small" color={colors.inkMuted}>{tr('احكيلنا إيه اللي لسه مش مظبوط، وهنفتح البلاغ تاني ونراجعه.', "Tell us what's still wrong, and we'll reopen the report and take another look.")}</AppText>
      <TextField value={note} onChangeText={setNote} multiline rows={2} placeholder={tr('مثلًا: الحفرة اتردمت بس النزلة لسه مكسورة', 'For example: the pothole was filled but the edge is still broken')} maxLength={300} testID="reopen-note" />
      {error ? <AppText variant="caption" color={colors.urgent} accessibilityLiveRegion="polite">{error}</AppText> : null}
      <Button label={tr('افتح البلاغ تاني', 'Reopen the report')} icon="refresh" variant="secondary" loading={busy} onPress={submit} testID="reopen-submit" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
});
