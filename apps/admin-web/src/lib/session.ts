'use client';

import { useEffect, useState } from 'react';
import type { StaffSession } from '@/domain/admin-types';
import { setApiToken } from './http';

const STORAGE_KEY = 'ftc-admin-session';

export function getSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export function setSession(session: StaffSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  setApiToken(session.token);
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  setApiToken(null);
}

/**
 * React hook to get the current session.
 * Hydration-safe: returns null on first render (SSR), then the actual session on the client.
 */
export function useSession(): StaffSession | null {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // We need to hydrate session from localStorage on client side
    // This is necessary for hydration and cannot be avoided
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setSession(getSession());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setIsHydrated(true);
  }, []);

  return isHydrated ? session : null;
}
