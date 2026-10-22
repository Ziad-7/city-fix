import { useCallback } from 'react';
import { usePrefs } from '@/store/usePrefs';

/**
 * Two languages: Arabic (default, RTL) and English (LTR).
 *
 * How to translate a component:
 *   const tr = useTr();                      // subscribes the component to the language
 *   <AppText>{tr('بلّغ عن مشكلة', 'Report a problem')}</AppText>
 * Outside React (helpers, stores) use `tr(ar, en)` / `getLang()`; they read the current language at call time,
 * so call them during the render of a component that used `useTr()` / `useLang()` (it re-renders on a switch).
 * Domain labels: `labelOf(category)`, `statusLabel(s)` etc. in `./labels`. Digits/dates: `localDigits`, `formatDate`.
 */
export type Lang = 'ar' | 'en';

export const getLang = (): Lang => usePrefs.getState().lang;

/** Subscribes the component to language changes. */
export const useLang = (): Lang => usePrefs((s) => s.lang);

export const isRtlLang = (lang: Lang): boolean => lang === 'ar';

/** True when the current layout is right-to-left (Arabic). */
export const useIsRTL = (): boolean => isRtlLang(useLang());

/** Picks the string for the current language (non-hook; see the note above). */
export function tr(ar: string, en: string): string {
  return getLang() === 'en' ? en : ar;
}

/** Hook version of `tr`: also re-renders the component when the language changes. */
export function useTr(): (ar: string, en: string) => string {
  const lang = useLang();
  return useCallback((ar: string, en: string) => (lang === 'en' ? en : ar), [lang]);
}

export const setLang = (lang: Lang): void => usePrefs.getState().setLang(lang);

export * from './labels';
