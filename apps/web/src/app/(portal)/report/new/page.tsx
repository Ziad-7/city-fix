import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'بلاغ جديد' };

export default function NewReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
