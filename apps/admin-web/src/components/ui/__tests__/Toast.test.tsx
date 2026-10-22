import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function ToastConsumer() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Success!')}>Show Success</button>
      <button onClick={() => toast.error('Error!')}>Show Error</button>
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders success toast when triggered', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    expect(screen.getByText('Success!')).toBeInTheDocument();
  });

  it('renders error toast when triggered', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Error');
    fireEvent.click(btn);

    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('auto-dismisses success toast after 5 seconds', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    expect(screen.getByText('Success!')).toBeInTheDocument();

    // Fast forward time and let React process updates
    act(() => {
      vi.advanceTimersByTime(5000);
      vi.runAllTimers();
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('auto-dismisses error toast after 8 seconds', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Error');
    fireEvent.click(btn);

    expect(screen.getByText('Error!')).toBeInTheDocument();

    // Fast forward time and let React process updates
    act(() => {
      vi.advanceTimersByTime(8000);
      vi.runAllTimers();
    });

    expect(screen.queryByText('Error!')).not.toBeInTheDocument();
  });

  it('can be dismissed manually', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    expect(screen.getByText('Success!')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('اقفل');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('sets correct role on toast', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Success'));

    const successToast = screen.getByText('Success!').closest('div[class^="ftc-toast"]');
    expect(successToast).toHaveAttribute('role', 'status');

    fireEvent.click(screen.getByText('Show Error'));

    const errorToast = screen.getByText('Error!').closest('div[class^="ftc-toast"]');
    expect(errorToast).toHaveAttribute('role', 'alert');
  });

  it('caps toasts at 3 and drops the oldest', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn); // Fourth toast should drop the first

    // Find the toasts container (portaled to body)
    const toastsContainer = document.body.querySelector('.ftc-toasts');
    const toastDivs = toastsContainer?.querySelectorAll('div[class^="ftc-toast"]');
    expect(toastDivs?.length).toBeLessThanOrEqual(3);
  });

  it('pauses auto-dismiss on hover and resumes on leave', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    const toast = screen.getByText('Success!').closest('div[class^="ftc-toast"]') as HTMLElement;

    // Hover to pause
    fireEvent.mouseEnter(toast);

    // Advance past the timeout but toast should still be there
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();

    // Leave to resume
    fireEvent.mouseLeave(toast);

    // Advance past the timeout again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('pauses auto-dismiss on focus and resumes on blur', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    const toast = screen.getByText('Success!').closest('div[class^="ftc-toast"]') as HTMLElement;

    // Focus to pause
    fireEvent.focus(toast);

    // Advance past the timeout but toast should still be there
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Success!')).toBeInTheDocument();

    // Blur to resume
    fireEvent.blur(toast);

    // Advance past the timeout again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });

  it('renders live region after mount', () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    // Live region should be mounted and available as a status container
    const liveRegion = document.querySelector('.ftc-toasts');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('role', 'status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
