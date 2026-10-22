'use client';

import { API_MODE } from '@/services';
import { useTr } from '@/i18n';

/** Only in mock mode: the prices on screen are sample numbers, not the district's. */
export function DemoPricesNote() {
  const tr = useTr();
  if (API_MODE !== 'mock') return null;
  return (
    <p className="ftc-help cc-demo-note" data-testid="demo-prices-note">
      {tr('الأسعار هنا تجريبية للعرض بس. السعر الحقيقي بيحدده الحي.', 'Prices here are sample numbers for the demo. The real price is set by the district.')}
    </p>
  );
}
