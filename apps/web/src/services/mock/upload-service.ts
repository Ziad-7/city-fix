import type { UploadService } from '../interfaces';

/** Mock: nothing is uploaded; the local URI is the "path". */
export function createMockUploadService(): UploadService {
  return { upload: async (uri) => uri };
}
