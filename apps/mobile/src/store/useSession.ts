import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DISTRICT, DEFAULT_GOVERNORATE } from '@/domain/locations';
import type { OtpChannel, Session } from '@/domain/types';
import { setApiToken } from '@/services/api/http';

export type Prefs = {
  /** Status updates by WhatsApp (SMS fallback). */
  whatsappUpdates: boolean;
  /** Light images; map loads on demand. On by default. */
  dataSaver: boolean;
};

type SessionState = {
  userId: string | null;
  phone: string | null;
  name: string | null;
  /** Bearer token (API mode). Persisted with the session; plain AsyncStorage for now (see README). */
  token: string | null;
  /** One-off notice for the sign-in screen (e.g. the session expired). Never persisted. */
  notice: string | null;
  governorate: string;
  district: string;
  otpChannel: OtpChannel;
  prefs: Prefs;
  /** Store the signed-in user (after OTP verification) and their area. */
  startSession: (s: Session, area?: { governorate: string; district: string }) => void;
  setArea: (governorate: string, district: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setOtpChannel: (c: OtpChannel) => void;
  setName: (name: string | null) => void;
  setNotice: (notice: string | null) => void;
  /** Clears the session (use `signOutAll` from store/actions to also clear cached data). */
  clear: () => void;
};

const initial = {
  userId: null,
  phone: null,
  name: null,
  token: null,
  notice: null,
  governorate: DEFAULT_GOVERNORATE,
  district: DEFAULT_DISTRICT,
  otpChannel: 'sms' as OtpChannel,
  prefs: { whatsappUpdates: true, dataSaver: true },
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      ...initial,
      startSession: (s, area) =>
        set((st) => ({
          userId: s.userId,
          phone: s.phone,
          name: s.name ?? st.name,
          token: s.token ?? null,
          notice: null,
          ...(area ?? {}),
        })),
      setArea: (governorate, district) => set({ governorate, district }),
      setPrefs: (p) => set((st) => ({ prefs: { ...st.prefs, ...p } })),
      setOtpChannel: (otpChannel) => set({ otpChannel }),
      setName: (name) => set({ name }),
      setNotice: (notice) => set({ notice }),
      clear: () => set({ userId: null, phone: null, name: null, token: null }),
    }),
    {
      name: 'ftc.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        userId: s.userId,
        phone: s.phone,
        name: s.name,
        token: s.token,
        governorate: s.governorate,
        district: s.district,
        otpChannel: s.otpChannel,
        prefs: s.prefs,
      }),
    },
  ),
);

// The HTTP client reads the token from here: on sign-in, on sign-out and when the persisted session is
// restored after an app restart (hydration also goes through `set`).
setApiToken(useSession.getState().token);
useSession.subscribe((s, prev) => {
  if (s.token !== prev.token) setApiToken(s.token);
});

/** True once the persisted session has been read from AsyncStorage. */
export function useSessionHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useSession.persist.onFinishHydration(cb),
    () => useSession.persist.hasHydrated(),
    () => false,
  );
}

export const useIsSignedIn = () => useSession((s) => s.userId !== null);
