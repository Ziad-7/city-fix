'use client';

import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  dismissible?: boolean;
  busy?: boolean;
}

export function Modal({ open, onClose, title, children, actions, dismissible = true, busy = false }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Prevent body scroll when modal is open
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

  // Use focus trap, but ignore Esc if busy
  useFocusTrap(modalRef, open, {
    onEscape: () => {
      if (!busy && dismissible) {
        onClose();
      }
    },
  });

  if (!open) return null;

  return createPortal(
    <>
      <div className="ftc-scrim" onClick={dismissible && !busy ? onClose : undefined} />
      <div className="ftc-modal-wrap">
        <div
          ref={modalRef}
          className="ftc-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={busy}
        >
          <h2 id={titleId}>{title}</h2>
          {children}
          {actions && <div className="actions">{actions}</div>}
        </div>
      </div>
    </>,
    document.body,
  );
}

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'إلغاء',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      dismissible={!busy}
      busy={busy}
      actions={
        <>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
