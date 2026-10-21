import { http } from './http';

// Browser uploads from docs/api-contract.md ("Photo uploads", proposed):
// POST /uploads/sign -> PUT the file to uploadUrl -> send `path` (photoUris / voiceNoteUri).
export async function uploadFile(blob: Blob, kind: 'report_photo' | 'voice_note', contentType: string): Promise<string> {
  const { uploadUrl, path } = await http<{ uploadUrl: string; path: string }>('POST', '/uploads/sign', { kind, contentType });
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!res.ok) throw new Error(kind === 'voice_note' ? 'معرفناش نرفع التسجيل، جرّب تاني' : 'معرفناش نرفع الصورة، جرّب تاني');
  return path;
}

export async function uploadPhoto(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  return uploadFile(blob, 'report_photo', 'image/jpeg');
}

/** POST /ai/transcribe (proposed, AI member): an uploaded voice note to Egyptian Arabic text. */
export const transcribe = (path: string) => http<{ text: string; language: string; confidence: number }>('POST', '/ai/transcribe', { path });
