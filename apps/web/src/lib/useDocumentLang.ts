'use client';

import { useEffect } from 'react';
import { isRtlLang, getLang, useLang } from '@/i18n';
import { usePrefs } from '@/store/usePrefs';

const apply = () => {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtlLang(lang) ? 'rtl' : 'ltr';
};

/**
 * Keeps <html lang dir> in step with the app language. (The inline script in app/layout.tsx sets it before first
 * paint; until the saved language has loaded this hook leaves it alone, so English does not flash back to RTL.)
 */
export function useDocumentLang(): void {
  const lang = useLang();
  useEffect(() => {
    if (usePrefs.persist.hasHydrated()) {
      apply();
      return;
    }
    return usePrefs.persist.onFinishHydration(apply);
  }, [lang]);
}
