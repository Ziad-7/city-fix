import { usePrefs } from '@/store/usePrefs';
import { localDigits } from './digits';

const NBSP = ' ';

/** Number with at most 2 decimals, no trailing zeros, digits and decimal mark of the current language. */
function plain(n: number): string {
  const s = String(Math.round(n * 100) / 100);
  const en = usePrefs.getState().lang === 'en';
  if (en) {
    const [int, dec] = s.split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
  }
  return localDigits(s).replace('.', '٫');
}

/** "١٢٠ جنيه" / "120 EGP" (no-break space). */
export function formatEgp(n: number): string {
  return `${plain(n)}${NBSP}${usePrefs.getState().lang === 'en' ? 'EGP' : 'جنيه'}`;
}

/** "٢٫٥ كجم" / "2.5 kg". */
export function formatKg(n: number): string {
  return `${plain(n)}${NBSP}${usePrefs.getState().lang === 'en' ? 'kg' : 'كجم'}`;
}

/** "٩ جنيه للكيلو" / "9 EGP/kg". */
export function formatEgpPerKg(n: number): string {
  return usePrefs.getState().lang === 'en' ? `${plain(n)}${NBSP}EGP/kg` : `${plain(n)}${NBSP}جنيه للكيلو`;
}
