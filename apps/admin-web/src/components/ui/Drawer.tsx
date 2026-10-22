'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  ariaLabel: string;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, titleId, ariaLabel, children }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Use focus trap
  useFocusTrap(drawerRef, open, {
    onEscape: () => onClose(),
  });

  if (!open) return null;

  return createPortal(
    <>
      <div className="ftc-scrim" aria-hidden onClick={onClose} />
      <aside
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
      >
        {children}
      </aside>
    </>,
    document.body,
  );
}
