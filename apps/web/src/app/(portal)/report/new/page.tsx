'use client';

import { Suspense } from 'react';
import { useTr } from '@/i18n';
import { usePageTitle } from '@/lib/usePageTitle';
import { ReportForm } from './ReportForm';

export default function NewReportPage() {
  const tr = useTr();
  usePageTitle(tr('بلاغ جديد', 'New report'));
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
