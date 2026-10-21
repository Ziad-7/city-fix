import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Extra text scale of the "خط أكبر" setting, on top of the system font scale. */
export const LARGE_TEXT_SCALE = 1.15;

/** Scale factor for the current setting. */
export const textScaleFor = (largeText: boolean): number => (largeText ? LARGE_TEXT_SCALE : 1);

/** Scales font size and line height; other values are kept. Rounded to a whole point so layouts stay crisp. */
export function scaleTextStyle<T extends { fontSize?: number; lineHeight?: number }>(style: T, scale: number): T {
  if (scale === 1) return style;
  return {
    ...style,
    ...(style.fontSize != null ? { fontSize: Math.round(style.fontSize * scale) } : null),
    ...(style.lineHeight != null ? { lineHeight: Math.round(style.lineHeight * scale) } : null),
  };
}

type PrefsState = {
  /** "خط أكبر": all AppText scaled by LARGE_TEXT_SCALE. */
  largeText: boolean;
  /** "إشعارات التطبيق": OS notifications for status changes. On by default. */
  appNotifications: boolean;
  setLargeText: (v: boolean) => void;
  setAppNotifications: (v: boolean) => void;
};

/** App-wide display and notification settings (separate from the session so they survive sign-out). */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      largeText: false,
      appNotifications: true,
      setLargeText: (largeText) => set({ largeText }),
      setAppNotifications: (appNotifications) => set({ appNotifications }),
    }),
    {
      name: 'ftc.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ largeText: s.largeText, appNotifications: s.appNotifications }),
    },
  ),
);
