import { Platform } from 'react-native';
import type { UploadService } from '../interfaces';
import { ApiError, http } from './http';

export const MSG_UPLOAD_FAILED = 'معرفناش نرفع الملف، جرّب تاني';

type SignResponse = { uploadUrl: string; path: string };

/**
 * POST /uploads/sign, then PUT the file bytes to the signed URL (Content-Type must match the signed one).
 * Returns the storage `path` the report sends in `photoUris` / `voiceNoteUri`.
 * A failed PUT is reported as a retryable network-style error (status 0): the offline queue tries again.
 */
export function createUploadService(): UploadService {
  return {
    async upload(localUri, kind, contentType) {
      const { uploadUrl, path } = await http<SignResponse>('POST', '/uploads/sign', { kind, contentType });
      if (!uploadUrl || !path) throw new ApiError(502, MSG_UPLOAD_FAILED);
      try {
        const status = await putFile(uploadUrl, localUri, contentType);
        if (status < 200 || status >= 300) throw new ApiError(0, MSG_UPLOAD_FAILED);
      } catch (e) {
        throw e instanceof ApiError ? e : new ApiError(0, MSG_UPLOAD_FAILED);
      }
      return path;
    },
  };
}

async function putFile(uploadUrl: string, localUri: string, contentType: string): Promise<number> {
  if (Platform.OS === 'web') {
    // blob: / data: URIs from the web picker can be read with fetch; the signed URL must allow CORS PUT.
    const blob = await (await fetch(localUri)).blob();
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
    return res.status;
  }
  // SDK 57: the classic uploadAsync lives in the `legacy` entry (the new File API has no raw PUT upload).
  const FS = await import('expo-file-system/legacy');
  const res = await FS.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  return res.status;
}
