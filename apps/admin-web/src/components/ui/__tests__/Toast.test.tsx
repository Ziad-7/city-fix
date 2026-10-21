import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders success toast when triggered', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });
  });

  it('renders error toast when triggered', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Error');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });
  });

  it('auto-dismisses success toast after 5 seconds', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    });
  });

  it('auto-dismisses error toast after 8 seconds', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Error');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });

    vi.advanceTimersByTime(8000);

    await waitFor(() => {
      expect(screen.queryByText('Error!')).not.toBeInTheDocument();
    });
  });

  it('can be dismissed manually', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const btn = screen.getByText('Show Success');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('اقفل');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    });
  });

  it('sets correct role on toast', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    const successBtn = screen.getByText('Show Success');
    fireEvent.click(successBtn);

    await waitFor(() => {
      const toast = screen.getByText('Success!').closest('div[class^="ftc-toast"]');
      expect(toast).toHaveAttribute('role', 'status');
    });

    const errorBtn = screen.getByText('Show Error');
    fireEvent.click(errorBtn);

    await waitFor(() => {
      const toast = screen.getByText('Error!').closest('div[class^="ftc-toast"]');
      expect(toast).toHaveAttribute('role', 'alert');
    });
  });
});
