import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { JobCard, JobsMap, ModeChip, WaitingBanner, useAcceptJob } from '@/components/collector';
import { AppText, InlineNotice, Screen, ScreenHeader } from '@/components/ui';
import { useTr } from '@/i18n';
import { defaultOrigin, useCollector } from '@/store/useCollector';
import { colors } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** الخريطة: open jobs as approximate areas; tap one to see it and accept. */
export default function CollectorMapScreen() {
  const tr = useTr();
  const jobs = useCollector((s) => s.jobs);
  const origin = useCollector((s) => s.origin) ?? defaultOrigin();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { accept, acceptingId, notice } = useAcceptJob();

  useFocusEffect(
    useCallback(() => {
      void useCollector.getState().refreshJobs().catch(() => undefined);
    }, []),
  );

  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  return (
    <Screen edges={['top']} header={<ScreenHeader title={tr('الخريطة', 'Map')} hideBack action={<ModeChip />} />} gap={14} contentStyle={styles.content} testID="collector-map">
      <WaitingBanner />
      {notice ? <InlineNotice text={notice} testID="job-notice" /> : null}
      <JobsMap jobs={jobs} origin={origin} selectedId={selectedId} onSelect={setSelectedId} style={styles.map} />
      <AppText variant="small" color={colors.inkMuted}>
        {jobs.length === 0
          ? tr('مفيش طلبات مفتوحة قريبة منك دلوقتي.', 'There are no open jobs near you right now.')
          : tr(`${localDigits(jobs.length)} طلب قريب. الدايرة بتبيّن المنطقة التقريبية مش العنوان بالظبط.`, `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} nearby. Each circle shows the approximate area, not the exact address.`)}
      </AppText>
      {selected ? (
        <JobCard job={selected} selected testID={`job-${selected.id}`} accepting={acceptingId === selected.id} onAccept={() => void accept(selected.id)} />
      ) : jobs.length > 0 ? (
        <View style={styles.hint}>
          <AppText variant="smallStrong" center>{tr('اختار طلب من الخريطة عشان تشوف تفاصيله', 'Pick a job on the map to see its details')}</AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  map: { minHeight: 280 },
  hint: { paddingVertical: 8 },
});
