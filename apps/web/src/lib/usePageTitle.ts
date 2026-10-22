'use client';

import { useEffect } from 'react';
import { tr, useLang } from '@/i18n';

export const appName = (): string => tr('سيتي فيكس', 'CityFix');

/** The browser tab title of the page: "<page> · سيتي فيكس" (the pages are client components, so no `metadata` export). */
export function usePageTitle(title: string | null | undefined) {
  const lang = useLang();
  useEffect(() => {
    if (title) document.title = `${title} · ${appName()}`;
  }, [title, lang]);
}
