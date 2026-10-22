/** Largest photo kept inside the queued report as a data URI (the queue lives in localStorage, which is small). */
const MAX_DATA_URI_BYTES = 400_000;

/**
 * Turns a blob: URI (gone after the page closes) into a data: URI so the queued report can still be sent later.
 * Files too large for localStorage keep their original URI.
 */
export async function persistLocalFile(uri: string): Promise<string> {
  if (!uri.startsWith('blob:')) return uri;
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_DATA_URI_BYTES) return uri;
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
