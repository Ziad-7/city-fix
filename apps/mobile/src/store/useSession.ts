import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DISTRICT, DEFAULT_GOVERNORATE } from '@/domain/locations';
import type { OtpChannel, Session } from '@/domain/types';

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
  /** Clears the session (use `signOutAll` from store/actions to also clear cached data). */
  clear: () => void;
};

const initial = {
  userId: null,
  phone: null,
  name: null,
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
          ...(area ?? {}),
        })),
      setArea: (governorate, district) => set({ governorate, district }),
      setPrefs: (p) => set((st) => ({ prefs: { ...st.prefs, ...p } })),
      setOtpChannel: (otpChannel) => set({ otpChannel }),
      setName: (name) => set({ name }),
      clear: () => set({ userId: null, phone: null, name: null }),
    }),
    {
      name: 'ftc.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        userId: s.userId,
        phone: s.phone,
        name: s.name,
        governorate: s.governorate,
        district: s.district,
        otpChannel: s.otpChannel,
        prefs: s.prefs,
      }),
    },
  ),
);

/** True once the persisted session has been read from AsyncStorage. */
export function useSessionHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useSession.persist.onFinishHydration(cb),
    () => useSession.persist.hasHydrated(),
    () => false,
  );
}

export const useIsSignedIn = () => useSession((s) => s.userId !== null);
