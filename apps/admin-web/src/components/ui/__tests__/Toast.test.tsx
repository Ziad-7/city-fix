import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('renders success toast when triggered', async () => {
    vi.useRealTimers(); // Use real timers for this test
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
    vi.useFakeTimers();
  });

  it('renders error toast when triggered', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Error');
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });
    vi.useFakeTimers();
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
    vi.useRealTimers();
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
    vi.useFakeTimers();
  });
});
