import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { CurrentJobCard, JobCard, ModeChip, WaitingBanner, pendingCompleteOf, useAcceptJob, useActorId, useCollectorQueue } from '@/components/collector';
import { AppText, Button, InlineNotice, Screen, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTr } from '@/i18n';
import { useCollector, useCurrentJob } from '@/store/useCollector';
import { colors } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** الشغل: my current job, then open jobs near me (nearest first). */
export default function CollectorJobsScreen() {
  const tr = useTr();
  const status = useCollector((s) => s.status);
  const error = useCollector((s) => s.error);
  const jobs = useCollector((s) => s.jobs);
  const profile = useCollector((s) => s.profile);
  const current = useCurrentJob();
  const queue = useCollectorQueue((s) => s.items);
  const userId = useActorId();
  const { accept, acceptingId, notice } = useAcceptJob();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const st = useCollector.getState();
      void (st.status === 'ready' ? st.refreshJobs() : st.refresh()).catch(() => undefined);
    }, []),
  );

  const reload = async () => {
    setRefreshing(true);
    try {
      await useCollector.getState().refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = profile ? profile.name.split(' ')[0] : null;
  return (
    <Screen
      edges={['top']}
      header={<ScreenHeader title={tr('الشغل', 'Jobs')} hideBack action={<ModeChip />} />}
      gap={14}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} />}
      contentStyle={styles.content}
      testID="collector-jobs"
    >
      {firstName ? <AppText variant="h3">{tr(`أهلًا يا ${firstName}`, `Hello, ${firstName}`)}</AppText> : null}
      <WaitingBanner />
      {notice ? <InlineNotice text={notice} testID="job-notice" /> : null}
      {current ? <CurrentJobCard job={current} waiting={!!pendingCompleteOf(queue, userId, current.id)} onContinue={() => router.push(`/collector/job/${current.id}`)} /> : null}

      <View style={styles.sectionHead}>
        <AppText variant="h3" accessibilityRole="header">{tr('طلبات قريبة منك', 'Jobs near you')}</AppText>
        {status === 'ready' ? <AppText variant="smallStrong" color={colors.inkMuted}>{localDigits(jobs.length)}</AppText> : null}
      </View>

      {status === 'loading' || status === 'idle' ? (
        <AppText color={colors.inkMuted} accessibilityLiveRegion="polite">{tr('بنحمّل الطلبات...', 'Loading jobs...')}</AppText>
      ) : status === 'error' ? (
        <View style={styles.state}>
          <Icon name="alert-triangle" size={28} color={colors.urgent} />
          <AppText center>{error ?? tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again')}</AppText>
          <Button label={tr('جرّب تاني', 'Try again')} variant="secondary" onPress={() => void reload()} />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.state} testID="no-jobs">
          <Icon name="recycle" size={32} color={colors.inkMuted} />
          <AppText variant="bodyStrong" center>{tr('مفيش طلبات قريبة دلوقتي', 'No jobs nearby right now')}</AppText>
          <AppText variant="small" color={colors.inkMuted} center>{tr('اسحب الشاشة لتحت عشان تحدّث، أو ارجع بعد شوية.', 'Pull down to refresh, or check back in a little while.')}</AppText>
        </View>
      ) : (
        jobs.map((j) => <JobCard key={j.id} job={j} testID={`job-${j.id}`} accepting={acceptingId === j.id} onAccept={() => void accept(j.id)} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  state: { alignItems: 'center', gap: 10, paddingVertical: 28 },
});
