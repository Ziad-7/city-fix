import * as FS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Copies a device-local file (photo, voice note) into the app's document folder, which the OS does not clear like
 * the cache. Returns the new file:// URI; throws if it cannot (the caller keeps the original URI).
 */
export async function persistLocalFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const dir = FS.documentDirectory;
  if (!dir || uri.startsWith(dir)) return uri;
  const folder = `${dir}outbox/`;
  await FS.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const ext = /\.([a-z0-9]{2,5})(?:\?.*)?$/i.exec(uri)?.[1] ?? 'bin';
  const to = `${folder}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await FS.copyAsync({ from: uri, to });
  return to;
}

const folderOf = (dir: string) => `${dir}outbox/`;

/** Deletes queue copies made by `persistLocalFile`. Anything outside the outbox folder is left alone. Never throws. */
export async function releasePersistedFiles(uris: string[]): Promise<void> {
  if (Platform.OS === 'web' || uris.length === 0) return;
  try {
      const dir = FS.documentDirectory;
    if (!dir) return;
    for (const uri of uris) {
      if (uri.startsWith(folderOf(dir))) await FS.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  } catch {
    // best effort
  }
}

/** On startup: deletes outbox files that no queued report refers to any more (a crash or an old version left them). */
export async function sweepOrphanedFiles(referenced: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
      const dir = FS.documentDirectory;
    if (!dir) return;
    const names = await FS.readDirectoryAsync(folderOf(dir)).catch(() => [] as string[]);
    const keep = new Set(referenced);
    for (const name of names) {
      const uri = `${folderOf(dir)}${name}`;
      if (!keep.has(uri)) await FS.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    }
  } catch {
    // best effort
  }
}
