import { http } from './http';

// Browser photo upload from docs/api-contract.md ("Photo uploads", proposed):
// POST /uploads/sign -> PUT the file to uploadUrl -> send `path` in photoUris.
export async function uploadPhoto(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { uploadUrl, path } = await http<{ uploadUrl: string; path: string }>('POST', '/uploads/sign', {
    kind: 'report_photo',
    contentType: 'image/jpeg',
  });
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  if (!res.ok) throw new Error('معرفناش نرفع الصورة، جرّب تاني');
  return path;
}
