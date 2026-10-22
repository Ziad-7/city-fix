import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTr } from '@/i18n';
import { isOffline } from '@/services/network';
import { useCollector } from '@/store/useCollector';
import { useTransientNotice } from '../ui/InlineNotice';

/**
 * Accept a job from the list or the map. First accept wins: when someone else was first the job list reloads and the
 * collector sees "حد سبقك عليه / Someone already took it". Accepting needs the internet (it is not queued).
 */
export function useAcceptJob() {
  const tr = useTr();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const { notice, show } = useTransientNotice(6000);
  const accept = useCallback(
    async (jobId: string) => {
      if (acceptingId) return;
      setAcceptingId(jobId);
      try {
        if (await isOffline()) {
          show(tr('مفيش نت. لازم تكون متصل عشان تقبل الشغل، لأن الأول بيشتغل.', 'No internet. You need to be online to accept a job, because the first to accept gets it.'));
          return;
        }
        const res = await useCollector.getState().accept(jobId);
        if (res.ok) router.push(`/collector/job/${jobId}`);
        else show(tr('حد سبقك عليه. حدّثنا القايمة.', 'Someone already took it. We updated the list.'));
      } catch (e) {
        show(e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptingId, show, tr],
  );
  return { accept, acceptingId, notice };
}
