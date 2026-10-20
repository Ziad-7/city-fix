import * as ImagePicker from 'expo-image-picker';

export type PhotoResult =
  | { kind: 'photo'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'failed' };

/** Camera first; a denied permission or a device without a camera is reported, never thrown. */
export async function takePhoto(quality: number): Promise<PhotoResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { kind: 'denied' };
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality });
    if (res.canceled || !res.assets[0]) return { kind: 'cancelled' };
    return { kind: 'photo', uri: res.assets[0].uri };
  } catch {
    return { kind: 'failed' };
  }
}

/** Gallery (the system picker needs no permission on current OS versions). */
export async function pickFromGallery(quality: number): Promise<PhotoResult> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality });
    if (res.canceled || !res.assets[0]) return { kind: 'cancelled' };
    return { kind: 'photo', uri: res.assets[0].uri };
  } catch {
    return { kind: 'failed' };
  }
}
