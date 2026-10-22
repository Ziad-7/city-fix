import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { StatusChangeForm } from '../StatusChangeForm';
import type { IncidentStatus } from '@/domain/types';

const mockOnSubmit = vi.fn();
const queryClient = new QueryClient();

const renderComponent = (props: any) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <StatusChangeForm
          kind="incident"
          currentStatus="received"
          options={[
            { value: 'received', label: 'وصل (الحالة الحالية)' },
            { value: 'triaged', label: 'اتصنّف' },
          ]}
          previewStatusFor={(v) => v as IncidentStatus}
          citizensCount={3}
          onSubmit={mockOnSubmit}
          {...props}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('StatusChangeForm', () => {
  beforeEach(() => {
    mockOnSubmit.mockClear();
    vi.clearAllMocks();
  });

  it('blocks submit without a note and shows validation message', async () => {
    renderComponent();

    // Select a new status
    const statusSelect = screen.getByDisplayValue('وصل (الحالة الحالية)');
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Try to submit without note
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('اكتب رسالة للمواطنين')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('requires a different status than current', async () => {
    renderComponent();

    // Note without status change
    const textarea = screen.getByDisplayValue('');
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    // Try to submit with same status
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('اختار حالة غير الحالة الحالية')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with status and note when valid', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    renderComponent();

    // Select new status
    const statusSelect = screen.getByDisplayValue('وصل (الحالة الحالية)');
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Write note
    const textarea = screen.getByDisplayValue('');
    fireEvent.change(textarea, { target: { value: 'استلمنا بلاغكم وبنراجعه.' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        status: 'triaged',
        note: 'استلمنا بلاغكم وبنراجعه.',
      });
    });
  });


  it('shows template chips when note is empty', async () => {
    renderComponent();

    // Select new status
    const statusSelect = screen.getByDisplayValue('وصل (الحالة الحالية)');
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Template should be visible when no note
    await waitFor(() => {
      expect(screen.getByText('استلمنا بلاغكم وبنراجعه.')).toBeInTheDocument();
    });
  });

  it('hides template chips when note is entered', async () => {
    renderComponent();

    // Select new status
    const statusSelect = screen.getByDisplayValue('وصل (الحالة الحالية)');
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Write note
    const textarea = screen.getByDisplayValue('');
    fireEvent.change(textarea, { target: { value: 'custom note' } });

    // Template button should not be visible
    await waitFor(() => {
      // The template text should not be in a clickable button
      const buttons = screen.queryAllByRole('button');
      const hasTemplate = buttons.some((btn) => btn.textContent === 'استلمنا بلاغكم وبنراجعه.');
      expect(hasTemplate).toBe(false);
    });
  });

  it('displays disabled state with reason', () => {
    renderComponent({ disabledReason: 'مش مسموح تغيير حالة بلاغات جهة تانية' });

    expect(screen.getByText('مش مسموح تغيير حالة بلاغات جهة تانية')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /حدّث الحالة/ })).not.toBeInTheDocument();
  });

  it('shows notification checkbox when citizensCount provided', () => {
    renderComponent({ citizensCount: 5 });

    expect(screen.getByLabelText(/ابعتها للـ 5 مواطنين/)).toBeInTheDocument();
  });

  it('hides template chips in compact mode', () => {
    renderComponent({ compact: true });

    // Select new status
    const statusSelect = screen.getByDisplayValue('وصل (الحالة الحالية)');
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Template should not be shown in compact mode
    expect(screen.queryByText('استلمنا بلاغكم وبنراجعه.')).not.toBeInTheDocument();
  });
});
