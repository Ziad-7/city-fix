import { useState } from 'react';
import { StyleSheet } from 'react-native';
import type { IncidentStatus } from '@/domain/types';
import { AppText, Button, Card, InlineNotice, TextField } from '@/components/ui';
import { useReports } from '@/store/useReports';
import { colors, fonts } from '@/theme/tokens';

/** "لسه المشكلة موجودة؟" on a resolved report: a short note and "افتح البلاغ تاني". Self-contained (uses the reports store). */
export function ReopenCard({ incidentId, status }: { incidentId: string; status: IncidentStatus }) {
  const reopen = useReports((s) => s.reopenIncident);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reopen(incidentId, note.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'معرفناش نفتح البلاغ، جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  // Mounted for every report; shown for a resolved one, and stays (as the confirmation) after it was reopened.
  if (!done && status !== 'resolved') return null;
  if (done) {
    return <InlineNotice testID="reopen-done" text="اتفتح البلاغ تاني، وهنراجعه ونبلّغك بأي جديد." />;
  }

  return (
    <Card rounded="lg" padding={16} style={styles.card} testID="reopen-card">
      <AppText style={styles.heading} accessibilityRole="header">لسه المشكلة موجودة؟</AppText>
      <AppText variant="small" color={colors.inkMuted}>احكيلنا إيه اللي لسه مش مظبوط، وهنفتح البلاغ تاني ونراجعه.</AppText>
      <TextField value={note} onChangeText={setNote} multiline rows={2} placeholder="مثلًا: الحفرة اتردمت بس النزلة لسه مكسورة" maxLength={300} testID="reopen-note" />
      {error ? <AppText variant="caption" color={colors.urgent} accessibilityLiveRegion="polite">{error}</AppText> : null}
      <Button label="افتح البلاغ تاني" icon="refresh" variant="secondary" loading={busy} onPress={submit} testID="reopen-submit" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
});
