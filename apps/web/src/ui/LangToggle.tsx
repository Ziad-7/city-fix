'use client';

import { setLang, useLang } from '@/i18n';

/** Compact language switch: shows the OTHER language's name ("English" in Arabic, "العربية" in English). */
export function LangToggle({ className, testId }: { className?: string; testId?: string }) {
  const lang = useLang();
  const label = lang === 'en' ? 'العربية' : 'English';
  return (
    <button
      type="button"
      className={className ?? 'w-lang'}
      data-testid={testId ?? 'lang-toggle'}
      lang={lang === 'en' ? 'ar' : 'en'}
      aria-label={label}
      onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
    >
      {label}
    </button>
  );
}
