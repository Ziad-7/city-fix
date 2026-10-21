'use client';

import { useSyncExternalStore } from 'react';
import type { StaffSession } from '@/domain/admin-types';
import { setApiToken } from './http';

const STORAGE_KEY = 'ftc-admin-session';

// External store for session state
type SessionState = StaffSession | null | undefined;
let sessionState: SessionState = undefined;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Subscribe to storage events (for cross-tab sync)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        sessionState = e.newValue ? (JSON.parse(e.newValue) as StaffSession) : null;
      } catch {
        sessionState = null;
      }
      notifyListeners();
    }
  });

  // Also subscribe to custom session change events
  window.addEventListener('session-change', () => {
    notifyListeners();
  });
}

export function getSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  if (sessionState !== undefined) return sessionState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      sessionState = null;
      return null;
    }
    sessionState = JSON.parse(raw) as StaffSession;
    return sessionState;
  } catch {
    sessionState = null;
    return null;
  }
}

export function setSession(session: StaffSession): void {
  if (typeof window === 'undefined') return;
  sessionState = session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  setApiToken(session.token);
  notifyListeners();
  window.dispatchEvent(new Event('session-change'));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionState = null;
  localStorage.removeItem(STORAGE_KEY);
  setApiToken(null);
  notifyListeners();
  window.dispatchEvent(new Event('session-change'));
}

/**
 * React hook to get the current session with tri-state:
 * - undefined = not yet hydrated (SSR)
 * - null = no session
 * - StaffSession = authenticated
 */
export function useSession(): SessionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => {
      // Hydrate on first call
      if (sessionState === undefined && typeof window !== 'undefined') {
        getSession();
      }
      return sessionState;
    },
    () => undefined // During SSR, return undefined (not hydrated)
  );
}
