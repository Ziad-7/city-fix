import NetInfo from '@react-native-community/netinfo';

/** True only when the OS says there is no connection (unknown counts as online: the request decides). */
export async function isOffline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s.isConnected === false || s.isInternetReachable === false;
  } catch {
    return false;
  }
}

export const isOnlineState = (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) =>
  s.isConnected === true && s.isInternetReachable !== false;
