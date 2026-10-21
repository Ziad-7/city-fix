import { services } from '@/services';
import { setUnauthorizedHandler } from '@/services/api/http';
import { voiceContentType } from '@/services/media';
import { expectOwnChange, useNotifications } from './useNotifications';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';
import { useSession } from './useSession';

export const SESSION_EXPIRED_MSG = 'الجلسة خلصت، سجّل دخول تاني.';

/** Loads reports, incidents and service requests (call once the user is signed in). */
export async function refreshAll(): Promise<void> {
  await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh()]);
}

export async function signOutAll(): Promise<void> {
  try {
    await services.auth.signOut();
  } finally {
    useReports.getState().reset();
    useNotifications.getState().reset();
    useServiceRequests.getState().reset();
    useSession.getState().clear();
  }
}

/** The API said 401: leave a short notice for the sign-in screen and sign out (the guard routes to /sign-in). */
let expiring = false;
export async function expireSession(): Promise<void> {
  if (expiring || !useSession.getState().userId) return;
  expiring = true;
  try {
    await signOutAll();
    useSession.getState().setNotice(SESSION_EXPIRED_MSG);
  } finally {
    expiring = false;
  }
}

setUnauthorizedHandler(() => void expireSession());

export type VoiceNoteResult = {
  /** What to send as `voiceNoteUri` (API mode: the storage path; mock: the local URI). null if the upload failed. */
  path: string | null;
  /** The transcript, or null when uploading or transcribing failed (the citizen types the description). */
  text: string | null;
};

/**
 * Uploads a recorded voice note and transcribes it. Never throws: a failure just leaves `text` (and maybe `path`) null.
 * `onUploaded` fires as soon as the file is stored (before the slower transcription), so a report sent meanwhile can
 * reuse the path instead of uploading the clip a second time.
 */
export async function uploadAndTranscribeVoiceNote(
  localUri: string,
  contentType = voiceContentType(localUri),
  onUploaded?: (path: string) => void,
): Promise<VoiceNoteResult> {
  let path: string;
  try {
    path = await services.uploads.upload(localUri, 'voice_note', contentType);
  } catch {
    return { path: null, text: null };
  }
  onUploaded?.(path);
  try {
    const { text } = await services.transcription.transcribe(path);
    return { path, text: text.trim() ? text.trim() : null };
  } catch {
    return { path, text: null };
  }
}

/**
 * "افتح البلاغ تاني": reopens a resolved incident. The citizen's own reports on it go back to "received" quietly
 * (no notification about their own action; the screen confirms it inline). Later changes notify as usual.
 */
export async function reopenReport(incidentId: string, note: string): Promise<void> {
  const ids = useReports
    .getState()
    .reports.filter((r) => r.incidentId === incidentId)
    .map((r) => r.id);
  const release = expectOwnChange(ids, 'received');
  try {
    await useReports.getState().reopenIncident(incidentId, note);
  } finally {
    release();
  }
}
