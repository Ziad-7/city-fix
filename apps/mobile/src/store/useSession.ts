import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DISTRICT, DEFAULT_GOVERNORATE } from '@/domain/locations';
import type { AppMode } from '@/domain/citycycle';
import type { OtpChannel, Session } from '@/domain/types';
import { setApiToken } from '@/services/api/http';
import { createSessionStorage } from './secureSessionStorage';

export type Prefs = {
  /** Status updates by WhatsApp (SMS fallback). */
  whatsappUpdates: boolean;
  /** Light images; map loads on demand. On by default. */
  dataSaver: boolean;
};

/**
 * Collector mode is offered when the mock backend is in use (the demo collector), or when the account has the
 * `collector` role.
 * TODO(api): the backend decides. Role `collector` is granted on verification (docs/api-contract.md, CityCycle >
 * "New enums" and "Collectors"); until /auth/verify returns `roles`, API mode never offers the switch.
 */
export const collectorModeAvailable = (roles: readonly string[]): boolean =>
  process.env.EXPO_PUBLIC_API_MODE !== 'api' || roles.includes('collector');

type SessionState = {
  userId: string | null;
  phone: string | null;
  name: string | null;
  /** Bearer token (API mode). Persisted with the session, but in expo-secure-store on native (see secureSessionStorage). */
  token: string | null;
  /** One-off notice for the sign-in screen (e.g. the session expired). Never persisted. */
  notice: string | null;
  governorate: string;
  district: string;
  otpChannel: OtpChannel;
  prefs: Prefs;
  /** Roles from the backend (API mode); empty in mock mode. */
  roles: string[];
  /** Citizen (default) or collector mode: the same account and app, a different set of screens. Persisted. */
  mode: AppMode;
  /** Store the signed-in user (after OTP verification) and their area. */
  startSession: (s: Session, area?: { governorate: string; district: string }) => void;
  setArea: (governorate: string, district: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setOtpChannel: (c: OtpChannel) => void;
  /** Switches the mode. Switching to `collector` is ignored unless `collectorModeAvailable` (use `switchMode` from store/actions to also reload data). */
  setMode: (mode: AppMode) => void;
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
  roles: [] as string[],
  mode: 'citizen' as AppMode,
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
          roles: s.roles ?? [],
          mode: 'citizen' as AppMode,
          notice: null,
          ...(area ?? {}),
        })),
      setArea: (governorate, district) => set({ governorate, district }),
      setPrefs: (p) => set((st) => ({ prefs: { ...st.prefs, ...p } })),
      setOtpChannel: (otpChannel) => set({ otpChannel }),
      setMode: (mode) => set((st) => (mode === 'collector' && !collectorModeAvailable(st.roles) ? st : { mode })),
      setName: (name) => set({ name }),
      setNotice: (notice) => set({ notice }),
      clear: () => set({ userId: null, phone: null, name: null, token: null, roles: [], mode: 'citizen' }),
    }),
    {
      name: 'ftc.session.v1',
      storage: createJSONStorage(() => createSessionStorage()),
      partialize: (s) => ({
        userId: s.userId,
        phone: s.phone,
        name: s.name,
        token: s.token,
        governorate: s.governorate,
        district: s.district,
        otpChannel: s.otpChannel,
        prefs: s.prefs,
        roles: s.roles,
        mode: s.mode,
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

/** Current mode; always `citizen` when collector mode is not available. */
export const useMode = (): AppMode => useSession((s) => (s.mode === 'collector' && collectorModeAvailable(s.roles) ? 'collector' : 'citizen'));
export const useCanUseCollectorMode = (): boolean => useSession((s) => s.userId !== null && collectorModeAvailable(s.roles));

export const useIsSignedIn = () => useSession((s) => s.userId !== null);
