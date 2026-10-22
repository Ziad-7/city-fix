import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmModal } from '../Modal';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ConfirmModal', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup handled by testing-library
  });

  it('renders when open', () => {
    render(
      <ConfirmModal
        open={true}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Test body')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ConfirmModal
        open={false}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    const confirmBtn = screen.getByText('Yes');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    const cancelBtn = screen.getByText('إلغاء');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('closes on Escape key when not busy', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open={true}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={() => {}}
        onCancel={onCancel}
        busy={false}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalled();
    });
  });

  it('disables buttons when busy', () => {
    render(
      <ConfirmModal
        open={true}
        title="Test Modal"
        body="Test body"
        confirmLabel="Yes"
        onConfirm={() => {}}
        onCancel={() => {}}
        busy={true}
      />,
    );

    const cancelBtn = screen.getByText('إلغاء') as HTMLButtonElement;
    expect(cancelBtn).toBeDisabled();
  });
});
