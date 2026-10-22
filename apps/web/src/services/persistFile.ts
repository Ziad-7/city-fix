/** Largest single photo kept inside the queued report as a data URI (the queue lives in localStorage, ~5 MB in all). */
const MAX_DATA_URI_BYTES = 400_000;
/** All data URIs together in the queue; beyond this a photo keeps its blob: URL instead of risking the storage quota. */
export const MAX_QUEUED_DATA_URI_CHARS = 2_500_000;

async function queuedDataUriChars(): Promise<number> {
  try {
    // Loaded on demand: the outbox store imports this module too.
    const { useOutbox } = await import('@/store/useOutbox');
    let total = 0;
    for (const item of useOutbox.getState().items) {
      for (const u of [...item.input.photoUris, item.input.voiceNoteUri ?? '']) if (u.startsWith('data:')) total += u.length;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Turns a blob: URI (gone after the page closes) into a data: URI so the queued report can still be sent later.
 * Files too large, or a queue already holding too much, keep their original URI; if even that cannot be stored the
 * form tells the person the report was not queued (isQueuedOnDevice).
 */
export async function persistLocalFile(uri: string): Promise<string> {
  if (!uri.startsWith('blob:')) return uri;
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_DATA_URI_BYTES) return uri;
  // A data URI is ~4/3 of the bytes.
  if ((await queuedDataUriChars()) + Math.ceil((blob.size * 4) / 3) > MAX_QUEUED_DATA_URI_CHARS) return uri;
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Data URIs live inside the queue itself, so there are no separate files to delete on the web. */
export async function releasePersistedFiles(_uris: string[]): Promise<void> {}
export async function sweepOrphanedFiles(_referenced: string[]): Promise<void> {}
