import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useCityCycle } from '@/store';

/**
 * While the screen is focused and `intervalMs` is set: refresh the bins now and then every `intervalMs`.
 * Stops when the layer is closed (`null`) or the user leaves the tab.
 */
export function useBinsPolling(intervalMs: number | null) {
  const refreshBins = useCityCycle((s) => s.refreshBins);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (intervalMs === null) return undefined;
      void refreshBins();
      timer.current = setInterval(() => void refreshBins(), intervalMs);
      return stop;
    }, [intervalMs, refreshBins, stop]),
  );
  useEffect(() => stop, [stop]);
}
