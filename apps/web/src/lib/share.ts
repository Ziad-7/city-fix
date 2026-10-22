'use client';

import { tr } from '@/i18n';
import { useToast } from '@/ui/toast';

/** Web Share when the browser has it (phones), else copy to the clipboard and say so. */
export async function shareText(text: string, url?: string): Promise<void> {
  const full = url ? `${text}\n${url}` : text;
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text, url });
      return;
    }
  } catch {
    // dismissed share sheet: not an error
    return;
  }
  try {
    await navigator.clipboard.writeText(full);
    useToast.getState().show(tr('اتنسخ، ابعته لجروب العمارة.', 'Copied. Send it to your building’s group.'));
  } catch {
    useToast.getState().show(tr('مقدرناش ننسخ الرابط، انسخه من شريط العنوان.', 'We couldn’t copy the link. Copy it from the address bar.'));
  }
}

/** WhatsApp share link (wa.me opens the app on phones and WhatsApp Web on desktop). */
export const whatsappHref = (text: string, url?: string) => `https://wa.me/?text=${encodeURIComponent(url ? `${text}\n${url}` : text)}`;

export const absoluteUrl = (path: string) => (typeof window === 'undefined' ? path : `${window.location.origin}${path}`);

export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    useToast.getState().show(tr('اتنسخ الرابط.', 'Link copied.'));
  } catch {
    useToast.getState().show(tr('مقدرناش ننسخ الرابط، انسخه من شريط العنوان.', 'We couldn’t copy the link. Copy it from the address bar.'));
  }
}
