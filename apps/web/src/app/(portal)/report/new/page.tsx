import { Suspense } from 'react';
import { ReportForm } from './ReportForm';

export default function NewReportPage() {
  return (
    <Suspense>
      <ReportForm />
    </Suspense>
  );
}
