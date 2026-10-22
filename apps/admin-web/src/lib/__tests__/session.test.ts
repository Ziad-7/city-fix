import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSession, getSession, clearSession, __resetSessionState } from '../session';
import type { StaffSession } from '@/domain/admin-types';
import * as httpModule from '../http';

// Mock the http module
vi.mock('../http', () => ({
  setApiToken: vi.fn(),
}));

const mockSession: StaffSession = {
  userId: 'staff-1',
  name: 'Test Staff',
  title: 'محقق',
  token: 'token-123',
  role: 'admin',
  district: 'القاهرة · حي مدينة نصر أول',
};

describe('session storage', () => {
  beforeEach(() => {
    // Clear all storage and reset internal state before each test
    localStorage.clear();
    sessionStorage.clear();
    __resetSessionState();
    vi.clearAllMocks();
  });

  describe('setSession', () => {
    it('should store session in localStorage', () => {
      setSession(mockSession);

      const stored = localStorage.getItem('ftc-admin-session');
      expect(stored).toBe(JSON.stringify(mockSession));
    });

    it('should call setApiToken with the token', () => {
      setSession(mockSession);

      expect(httpModule.setApiToken).toHaveBeenCalledWith('token-123');
    });
  });

  describe('getSession', () => {
    it('should retrieve session from localStorage', () => {
      setSession(mockSession);
      const retrieved = getSession();

      expect(retrieved).toEqual(mockSession);
    });

    it('should return null when no session stored', () => {
      const result = getSession();
      expect(result).toBeNull();
    });

    it('should return null on invalid JSON', () => {
      localStorage.setItem('ftc-admin-session', 'invalid json {');
      const result = getSession();
      expect(result).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should remove session from localStorage', () => {
      setSession(mockSession);
      expect(getSession()).not.toBeNull();

      clearSession();

      expect(localStorage.getItem('ftc-admin-session')).toBeNull();
    });

    it('should call setApiToken(null)', () => {
      setSession(mockSession);
      vi.clearAllMocks();

      clearSession();

      expect(httpModule.setApiToken).toHaveBeenCalledWith(null);
    });
  });

  describe('roundtrip', () => {
    it('should support setSession -> getSession flow with token', () => {
      setSession(mockSession);
      expect(httpModule.setApiToken).toHaveBeenCalledWith('token-123');

      const retrieved = getSession();
      expect(retrieved).toEqual(mockSession);
      expect(retrieved?.token).toBe('token-123');
    });
  });

  describe('remember device storage', () => {
    it('should store to localStorage when remember=true', () => {
      setSession(mockSession, { remember: true });

      expect(localStorage.getItem('ftc-admin-session')).toBeTruthy();
      expect(sessionStorage.getItem('ftc-admin-session-temp')).toBeNull();
    });

    it('should store to sessionStorage when remember=false', () => {
      setSession(mockSession, { remember: false });

      expect(localStorage.getItem('ftc-admin-session')).toBeNull();
      expect(sessionStorage.getItem('ftc-admin-session-temp')).toBeTruthy();
    });
  });
});
