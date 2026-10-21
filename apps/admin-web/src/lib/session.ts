'use client';

import { useSyncExternalStore } from 'react';
import type { StaffSession } from '@/domain/admin-types';
import { setApiToken } from './http';

const LS_KEY = 'ftc-admin-session';
const SS_KEY = 'ftc-admin-session-temp';

// External store for session state
type SessionState = StaffSession | null | undefined;
let sessionState: SessionState = undefined;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function applyToken(state: SessionState) {
  setApiToken(state?.token ?? null);
}

function hydrateFromStorage(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try localStorage first (remember=true)
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const session = JSON.parse(raw) as StaffSession;
      applyToken(session);
      return session;
    }
    // Fall back to sessionStorage (remember=false)
    const ssRaw = sessionStorage.getItem(SS_KEY);
    if (ssRaw) {
      const session = JSON.parse(ssRaw) as StaffSession;
      applyToken(session);
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

// Subscribe to storage events (for cross-tab sync)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY || e.key === SS_KEY) {
      try {
        sessionState = e.newValue ? (JSON.parse(e.newValue) as StaffSession) : null;
        applyToken(sessionState);
      } catch {
        sessionState = null;
        applyToken(null);
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
  sessionState = hydrateFromStorage();
  return sessionState;
}

export function setSession(session: StaffSession, { remember = true } = {}): void {
  if (typeof window === 'undefined') return;
  sessionState = session;
  applyToken(session);

  // Write to appropriate storage
  if (remember) {
    localStorage.setItem(LS_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SS_KEY);
  } else {
    sessionStorage.setItem(SS_KEY, JSON.stringify(session));
    localStorage.removeItem(LS_KEY);
  }

  notifyListeners();
  window.dispatchEvent(new Event('session-change'));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionState = null;
  applyToken(null);
  localStorage.removeItem(LS_KEY);
  sessionStorage.removeItem(SS_KEY);
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
        sessionState = hydrateFromStorage();
      }
      return sessionState;
    },
    () => undefined // During SSR, return undefined (not hydrated)
  );
}

// Test-only helper to reset session state
export function __resetSessionState() {
  sessionState = undefined as SessionState;
}
