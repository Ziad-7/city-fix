import type { NewReportInput, UploadKind } from '@/domain/types';
import { ApiError } from './api/http';

/** Report photos are shrunk before upload: long side at most this many pixels, JPEG at this quality. */
export const MAX_PHOTO_SIDE = 1600;
export const PHOTO_QUALITY = 0.7;
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

/** Target size keeping the aspect ratio with the long side at most `max`; null when it already fits. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const long = Math.max(width, height);
  if (long <= max) return null;
  const scale = max / long;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A device-local file that must be uploaded (a storage path returned by the API must not be). */
export function needsUpload(uri: string | undefined | null): uri is string {
  return !!uri && /^(file|blob|content|ph|assets-library|data):/i.test(uri);
}

/** Content type for a recorded voice note, from the file extension (default: AAC in MP4, the recorder's default). */
export function voiceContentType(uri: string): string {
  const ext = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(uri)?.[1]?.toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'webm':
      return 'audio/webm';
    case '3gp':
      return 'audio/3gpp';
    case 'caf':
      return 'audio/x-caf';
    default:
      return 'audio/mp4';
  }
}

/** What to do with a failed submit: keep it for later, drop it (the server said no), or wait for sign-in. */
export type FailureKind = 'retry' | 'drop' | 'auth';

export function classifyFailure(e: unknown): FailureKind {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'auth';
    if (e.status === 0 || e.status >= 500 || e.status === 408 || e.status === 429) return 'retry';
    return 'drop';
  }
  // fetch itself rejected (some runtimes) or an unknown failure: treat as connectivity.
  if (e instanceof TypeError) return 'retry';
  return 'drop';
}

/**
 * Resizes and recompresses one photo (long side <= 1600 px, JPEG 0.7). Never throws: where the manipulator is
 * unavailable (some web browsers) or fails, the original URI is used.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const ctx = ImageManipulator.manipulate(uri);
    let ref = await ctx.renderAsync();
    const target = fitWithin(ref.width, ref.height);
    if (target) {
      // Resize by the long side only: the other side follows the aspect ratio.
      ctx.resize(ref.width >= ref.height ? { width: target.width } : { height: target.height });
      ref = await ctx.renderAsync();
    }
    const out = await ref.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
    return out.uri || uri;
  } catch {
    return uri;
  }
}

export type Upload = (localUri: string, kind: UploadKind, contentType: string) => Promise<string>;

/** Prepare a photo for AI triage only after explicit consent. The API receives a private storage path, never a local URI. */
export async function prepareTriagePhoto(
  photoUri: string | undefined,
  consent: boolean,
  upload: Upload,
): Promise<{ photoUri?: string; photoConsent: boolean }> {
  if (!photoUri || !consent) return { photoConsent: false };
  if (!needsUpload(photoUri)) return { photoUri, photoConsent: true };
  const small = await compressImage(photoUri);
  return { photoUri: await upload(small, 'report_photo', PHOTO_CONTENT_TYPE), photoConsent: true };
}

/**
 * Prepares a report for POST /reports: compresses local photos and uploads local files, replacing them with the
 * returned paths. Already-uploaded paths are left alone, so calling it again on a half-prepared input is safe.
 * In mock mode `upload` returns the URI, so only the compression has an effect.
 */
export async function prepareReportInput(input: NewReportInput, upload: Upload): Promise<NewReportInput> {
  const photoUris: string[] = [];
  for (const uri of input.photoUris) {
    if (!needsUpload(uri)) {
      photoUris.push(uri);
      continue;
    }
    const small = await compressImage(uri);
    photoUris.push(await upload(small, 'report_photo', PHOTO_CONTENT_TYPE));
  }
  let voiceNoteUri = input.voiceNoteUri;
  if (needsUpload(voiceNoteUri)) voiceNoteUri = await upload(voiceNoteUri, 'voice_note', voiceContentType(voiceNoteUri));
  return { ...input, photoUris, voiceNoteUri };
}
