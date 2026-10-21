import { localDigits } from '@/utils/digits';

/** A voice note stops by itself after this many seconds. */
export const MAX_VOICE_SECONDS = 60;

/** 7 -> "٠٠:٠٧", 65 -> "٠١:٠٥" (Arabic-Indic digits in Arabic, Western in English; negative/NaN clamp to zero). */
export function formatTimer(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return localDigits(`${mm}:${ss}`);
}

/** Adds a transcript to what the citizen already typed: on a new line, never replacing their text. */
export function appendTranscript(existing: string, transcript: string): string {
  const add = transcript.trim();
  if (!add) return existing;
  const base = existing.trimEnd();
  return base ? `${base}\n${add}` : add;
}
