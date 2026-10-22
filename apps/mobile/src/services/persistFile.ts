import { Platform } from 'react-native';

/**
 * Copies a device-local file (photo, voice note) into the app's document folder, which the OS does not clear like
 * the cache. Returns the new file:// URI; throws if it cannot (the caller keeps the original URI).
 */
export async function persistLocalFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  const FS = await import('expo-file-system/legacy');
  const dir = FS.documentDirectory;
  if (!dir || uri.startsWith(dir)) return uri;
  const folder = `${dir}outbox/`;
  await FS.makeDirectoryAsync(folder, { intermediates: true }).catch(() => undefined);
  const ext = /\.([a-z0-9]{2,5})(?:\?.*)?$/i.exec(uri)?.[1] ?? 'bin';
  const to = `${folder}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await FS.copyAsync({ from: uri, to });
  return to;
}
