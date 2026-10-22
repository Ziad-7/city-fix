import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type BinReportsState = {
  /** binId -> ISO time this device last reported the bin full (the server enforces once per 24 h per person). */
  lastReportedAt: Record<string, string>;
  markReported: (binId: string, at?: string) => void;
};

/** Remembers "bin is full" reports on this device so the screen can explain the 24 h rule before a tap. */
export const useBinReports = create<BinReportsState>()(
  persist(
    (set) => ({
      lastReportedAt: {},
      markReported: (binId, at = new Date().toISOString()) => set((s) => ({ lastReportedAt: { ...s.lastReportedAt, [binId]: at } })),
    }),
    {
      name: 'ftc.binreports.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastReportedAt: s.lastReportedAt }),
    },
  ),
);
