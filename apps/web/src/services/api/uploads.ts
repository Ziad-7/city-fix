import { tr } from '@/i18n';
import type { UploadService } from '../interfaces';
import { ApiError, http } from './http';

// Web version of apps/mobile/src/services/api/uploads.ts: the browser reads blob:/data: URIs with fetch.
// POST /uploads/sign, then PUT the bytes to the signed URL (Content-Type must match the signed one).

export const MSG_UPLOAD_FAILED = 'معرفناش نرفع الملف، جرّب تاني';
const msgUploadFailed = () => tr(MSG_UPLOAD_FAILED, "We couldn't upload the file. Try again");

type SignResponse = { uploadUrl: string; path: string };

export function createUploadService(): UploadService {
  return {
    async upload(localUri, kind, contentType) {
      const { uploadUrl, path } = await http<SignResponse>('POST', '/uploads/sign', { kind, contentType });
      if (!uploadUrl || !path) throw new ApiError(502, msgUploadFailed());
      try {
        const blob = await (await fetch(localUri)).blob();
        const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
        if (!res.ok) throw new ApiError(0, msgUploadFailed());
      } catch (e) {
        // A failed PUT is a retryable network-style error (status 0): the offline queue tries again.
        throw e instanceof ApiError ? e : new ApiError(0, msgUploadFailed());
      }
      return path;
    },
  };
}
