'use client';

import { useEffect } from 'react';

export const APP_NAME = 'سيتي فيكس';

/** The browser tab title of the page: "<page> · سيتي فيكس" (the pages are client components, so no `metadata` export). */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
