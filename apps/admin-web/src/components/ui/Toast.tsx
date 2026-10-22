'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
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

  const dismiss = useCallback((id: string) => {
    // Clear any pending timeout for this toast
    const timerId = timerRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timerRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((kind: 'success' | 'error', msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, kind, msg }].slice(-3)); // max 3

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

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="ftc-toasts" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`ftc-toast ftc-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
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
