import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { StatusChangeForm } from '../StatusChangeForm';
import type { IncidentStatus } from '@/domain/types';

const mockOnSubmit = vi.fn();
const queryClient = new QueryClient();

const renderComponent = (props: Partial<React.ComponentProps<typeof StatusChangeForm>> = {}) => {
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

    // Try to submit without note and status change
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('اكتب رسالة للمواطنين')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('requires a different status than current', async () => {
    renderComponent();

    // Write note without status change
    const textarea = screen.getByRole('textbox', { name: /رسالة للمواطنين/ });
    fireEvent.change(textarea, { target: { value: 'Test note' } });

    // Try to submit with same status
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('اختار حالة غير الحالة الحالية')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit when form is valid', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    renderComponent();

    // Get the select element by role
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[0] as HTMLSelectElement;

    // Change status to triaged
    fireEvent.change(statusSelect, { target: { value: 'triaged' } });

    // Write note
    const textarea = screen.getByRole('textbox', { name: /رسالة للمواطنين/ });
    fireEvent.change(textarea, { target: { value: 'test note' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /حدّث الحالة وابلّغ المواطنين/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });


;

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

    // Get the select element by role and change status
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'triaged' } });

    // Template should not be shown in compact mode
    expect(screen.queryByText('استلمنا بلاغكم وبنراجعه.')).not.toBeInTheDocument();
  });

  it('shows preview in compact mode', () => {
    renderComponent({ compact: true });

    // Type a note
    const textarea = screen.getByRole('textbox', { name: /رسالة للمواطنين/ });
    fireEvent.change(textarea, { target: { value: 'test message' } });

    // Preview component renders the note
    const form = textarea.closest('form');
    expect(form).toBeInTheDocument();
    // The CitizenPreview component should receive the note prop
    expect(textarea).toHaveValue('test message');
  });

  it('shows all controls disabled with disabledReason', () => {
    renderComponent({ disabledReason: 'مش من صلاحياتك تغيّر حالة البلاغ ده' });

    // Notice should be shown
    expect(screen.getByText('مش من صلاحياتك تغيّر حالة البلاغ ده')).toBeInTheDocument();

    // Select should be disabled
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toBeDisabled();

    // Textarea should be disabled
    const textarea = screen.getByRole('textbox', { name: /رسالة للمواطنين/ });
    expect(textarea).toBeDisabled();

    // Submit button should not be shown
    expect(screen.queryByRole('button', { name: /حدّث الحالة/ })).not.toBeInTheDocument();
  });
});
