'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

type ToastState = { message: string | null; show: (m: string) => void; hide: () => void };

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));

/** Short notice at the bottom of the page (the app's inline toast). */
export function Toast() {
  const message = useToast((s) => s.message);
  const hide = useToast((s) => s.hide);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3500);
    return () => clearTimeout(t);
  }, [message, hide]);
  return (
    <div className="a-toast" role="status" aria-live="polite">
      {message ? <span>{message}</span> : null}
    </div>
  );
}
