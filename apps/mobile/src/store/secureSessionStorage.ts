import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

export const TOKEN_KEY = 'ftc.token';

type Persisted = { state?: { token?: string | null; [k: string]: unknown }; version?: number };

const parse = (raw: string): Persisted | null => {
  try {
    const v = JSON.parse(raw) as Persisted;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
};

/**
 * zustand storage for the session: everything goes to AsyncStorage except the bearer token, which lives in
 * expo-secure-store (Keychain / Keystore) on native. Web keeps the token in AsyncStorage (localStorage).
 * An existing token in the old AsyncStorage copy is migrated on first read. If SecureStore is unavailable the
 * token silently stays in AsyncStorage rather than logging the user out.
 */
export function createSessionStorage(isWeb = Platform.OS === 'web'): StateStorage {
  if (isWeb) return AsyncStorage;
  // zustand writes the whole session on every change (notice, prefs …). Writes run one after another so a sign-out
  // (delete) can never land before an older sign-in (set), and the Keystore is only touched when the token changed.
  let queue: Promise<void> = Promise.resolve();
  let lastToken: string | null | undefined;
  const serial = (job: () => Promise<void>): Promise<void> => {
    const next = queue.then(job, job);
    queue = next.catch(() => undefined);
    return next;
  };
  return {
    async getItem(name) {
      const raw = await AsyncStorage.getItem(name);
      if (raw === null) return null;
      const saved = parse(raw);
      if (!saved?.state) return raw;
      try {
        const secure = await SecureStore.getItemAsync(TOKEN_KEY);
        if (secure && saved.state.userId) {
          saved.state.token = secure;
          lastToken = secure;
        } else if (saved.state.token) {
          // Migration: a token written by an older build sits in AsyncStorage; move it.
          await SecureStore.setItemAsync(TOKEN_KEY, saved.state.token);
          lastToken = saved.state.token;
          await AsyncStorage.setItem(name, JSON.stringify(stripToken(saved)));
        }
      } catch {
        // SecureStore unavailable: keep whatever AsyncStorage had.
      }
      return JSON.stringify(saved);
    },
    setItem(name, value) {
      return serial(async () => {
        const saved = parse(value);
        if (!saved?.state) return AsyncStorage.setItem(name, value);
        const token = saved.state.token ?? null;
        try {
          if (token !== lastToken) {
            if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
            else await SecureStore.deleteItemAsync(TOKEN_KEY);
            lastToken = token;
          }
          return AsyncStorage.setItem(name, JSON.stringify(stripToken(saved)));
        } catch {
          return AsyncStorage.setItem(name, value);
        }
      });
    },
    removeItem(name) {
      return serial(async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        lastToken = null;
        await AsyncStorage.removeItem(name);
      });
    },
  };
}

function stripToken(p: Persisted): Persisted {
  const { token: _token, ...rest } = p.state ?? {};
  return { ...p, state: { ...rest, token: null } };
}
