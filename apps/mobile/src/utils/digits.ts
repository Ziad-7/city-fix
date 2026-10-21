import { usePrefs } from '@/store/usePrefs';

const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Convert Western digits (and numbers) to Arabic-Indic digits. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => AR[Number(d)]);
}

/**
 * Digits for display in the current language: Arabic-Indic in Arabic, Western in English.
 * Use this in UI copy instead of toArabicDigits.
 */
export function localDigits(value: string | number): string {
  return usePrefs.getState().lang === 'en' ? toWesternDigits(String(value)) : toArabicDigits(value);
}

/** Convert Arabic-Indic and Persian digits back to Western digits. */
export function toWesternDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Egyptian mobile: 01[0125] followed by 8 digits. Accepts spaces and Arabic digits. */
export function normalizeEgyptPhone(input: string): string {
  return toWesternDigits(input).replace(/[\s\-+()]/g, '').replace(/^(0020|20)/, '0');
}

export function isValidEgyptPhone(input: string): boolean {
  return /^01[0125]\d{8}$/.test(normalizeEgyptPhone(input));
}

/** "01012345678" -> "010 1234 5678" */
export function formatEgyptPhone(input: string): string {
  const p = normalizeEgyptPhone(input);
  if (p.length !== 11) return input;
  return `${p.slice(0, 3)} ${p.slice(3, 7)} ${p.slice(7)}`;
}

/** "01012345678" -> "010 •••• 5678" */
export function maskPhone(input: string): string {
  const p = normalizeEgyptPhone(input);
  if (p.length !== 11) return input;
  return `${p.slice(0, 3)} •••• ${p.slice(7)}`;
}

/** Wrap Latin-digit runs (phone numbers, IDs) so they keep their order inside Arabic sentences. */
export const isolateLtr = (s: string): string => `⁦${s}⁩`;
