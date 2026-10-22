import { useEffect } from 'react';

export interface UseFocusTrapOptions {
  initialFocus?: HTMLElement | null;
  onEscape?: () => void;
}

/**
 * Focus trap hook for dialogs and drawers.
 * - Focuses first focusable element on open (or explicit initialFocus)
 * - Cycles Tab/Shift+Tab within focusable elements
 * - Calls onEscape when Esc is pressed
 * - Restores focus to opener on close
 * Focusable selector excludes [disabled] and [tabindex="-1"]
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  options: UseFocusTrapOptions = {},
) {
  const { initialFocus, onEscape } = options;

  useEffect(() => {
    if (!open || !ref.current) return;

    const container = ref.current;
    const previousFocus = document.activeElement as HTMLElement;

    // Get all focusable elements, excluding disabled and tabindex="-1"
    const getFocusables = () => {
      return Array.from(
        container.querySelectorAll(
          'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
        ),
      ) as HTMLElement[];
    };

    // Focus initial element synchronously
    let firstFocusable = initialFocus;
    if (!firstFocusable) {
      const focusables = getFocusables();
      firstFocusable = focusables.length > 0 ? focusables[0] : container;
      // Set tabindex=-1 on container if it's the fallback focus target
      if (!firstFocusable || firstFocusable === container) {
        container.tabIndex = -1;
      }
    }
    if (firstFocusable) {
      firstFocusable.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
      } else if (e.key === 'Tab') {
        const focusables = getFocusables();
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      container.tabIndex = -1; // Reset if we set it
      previousFocus?.focus();
    };
  }, [open, ref, initialFocus, onEscape]);
}
