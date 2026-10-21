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
  return {
    async getItem(name) {
      const raw = await AsyncStorage.getItem(name);
      if (raw === null) return null;
      const saved = parse(raw);
      if (!saved?.state) return raw;
      try {
        const secure = await SecureStore.getItemAsync(TOKEN_KEY);
        if (secure) {
          saved.state.token = secure;
        } else if (saved.state.token) {
          // Migration: a token written by an older build sits in AsyncStorage; move it.
          await SecureStore.setItemAsync(TOKEN_KEY, saved.state.token);
          await AsyncStorage.setItem(name, JSON.stringify(stripToken(saved)));
        }
      } catch {
        // SecureStore unavailable: keep whatever AsyncStorage had.
      }
      return JSON.stringify(saved);
    },
    async setItem(name, value) {
      const saved = parse(value);
      if (!saved?.state) return AsyncStorage.setItem(name, value);
      const token = saved.state.token ?? null;
      try {
        if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
        else await SecureStore.deleteItemAsync(TOKEN_KEY);
        return AsyncStorage.setItem(name, JSON.stringify(stripToken(saved)));
      } catch {
        return AsyncStorage.setItem(name, value);
      }
    },
    async removeItem(name) {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      await AsyncStorage.removeItem(name);
    },
  };
}

function stripToken(p: Persisted): Persisted {
  const { token: _token, ...rest } = p.state ?? {};
  return { ...p, state: { ...rest, token: null } };
}
