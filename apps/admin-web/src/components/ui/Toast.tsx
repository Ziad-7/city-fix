'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';

interface Toast {
  id: string;
  kind: 'success' | 'error';
  msg: string;
}

export interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

type ToastContextType = ToastApi;

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pausedRef = useRef<Set<string>>(new Set());
  const counterRef = useRef<number>(0);

  // Track client-side mount to avoid hydration mismatch
  const mounted = useSyncExternalStore(
    () => () => {}, // subscribe (no-op for this use case)
    () => true,      // getSnapshot (client)
    () => false,     // getServerSnapshot (server)
  );

  const dismiss = useCallback((id: string) => {
    // Clear any pending timeout for this toast
    const timerId = timerRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timerRef.current.delete(id);
    }
    pausedRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((kind: 'success' | 'error', msg: string) => {
    const id = (++counterRef.current).toString();
    setToasts((prev) => {
      const updated = [...prev, { id, kind, msg }];
      // If we exceed 3, clear timer and remove the oldest one
      if (updated.length > 3) {
        const oldest = updated[0];
        const timerId = timerRef.current.get(oldest.id);
        if (timerId) {
          clearTimeout(timerId);
          timerRef.current.delete(oldest.id);
        }
        pausedRef.current.delete(oldest.id);
        return updated.slice(1);
      }
      return updated;
    });

    const timeout = kind === 'success' ? 5000 : 8000;
    const timerId = setTimeout(() => dismiss(id), timeout);
    timerRef.current.set(id, timerId);

    return { id, timerId };
  }, [dismiss]);

  // Clean up all timeouts on unmount
  useEffect(() => {
    const timers = timerRef.current;
    return () => {
      timers.forEach((timerId) => {
        clearTimeout(timerId);
      });
      timers.clear();
    };
  }, []);

  const success = useCallback((msg: string) => {
    add('success', msg);
  }, [add]);

  const error = useCallback((msg: string) => {
    add('error', msg);
  }, [add]);

  const handlePause = (id: string) => {
    pausedRef.current.add(id);
    const timerId = timerRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
    }
  };

  const handleResume = (id: string) => {
    pausedRef.current.delete(id);
    const kind = toasts.find((t) => t.id === id)?.kind;
    if (!kind) return;

    const timeout = kind === 'success' ? 5000 : 8000;
    const timerId = setTimeout(() => dismiss(id), timeout);
    timerRef.current.set(id, timerId);
  };

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {mounted && createPortal(
        <div
          className="ftc-toasts"
          role="status"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`ftc-toast ftc-toast--${t.kind}`}
              role={t.kind === 'error' ? 'alert' : 'status'}
              onMouseEnter={() => handlePause(t.id)}
              onMouseLeave={() => handleResume(t.id)}
              onFocus={() => handlePause(t.id)}
              onBlur={() => handleResume(t.id)}
            >
              <Icon name={t.kind === 'error' ? 'alert-triangle' : 'check'} size={20} />
              <span>{t.msg}</span>
              <button type="button" aria-label="اقفل" onClick={() => dismiss(t.id)}>
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

