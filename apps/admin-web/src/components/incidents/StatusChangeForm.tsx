'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  SelectField,
  TextArea,
  Button,
  Checkbox,
  CitizenPreview,
  Notice,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { IncidentStatus } from '@/domain/types';

export interface StatusOption {
  value: string;
  label: string;
}

export interface StatusChangeFormProps {
  kind: 'incident' | 'workorder' | 'service';
  currentStatus: string;
  options: StatusOption[];
  defaultStatus?: string;
  previewStatusFor: (value: string) => IncidentStatus;
  submitLabel?: string;
  citizensCount?: number;
  disabledReason?: string;
  compact?: boolean;
  onSubmit: (v: { status: string; note: string }) => Promise<void>;
}

const STATUS_TEMPLATES: Record<string, string> = {
  received: 'استلمنا بلاغكم وبنراجعه.',
  triaged: 'استلمنا بلاغكم وبنراجعه.',
  assigned: 'اتحوّل للجهة المسؤولة وهيتابعوا معاكم قريب.',
  in_progress: 'الفريق بدأ الشغل في الموقع. هنبلّغكم أول ما نخلّص.',
  resolved: 'اتصلّح المكان. لو لسه فيه مشكلة بلّغونا تاني.',
  closed: 'اتقفل البلاغ ده. شكرًا لتعاونكم.',
  // Work order templates
  open: 'assigned',
  done: 'resolved',
};

export function StatusChangeForm({
  currentStatus,
  options,
  defaultStatus = currentStatus,
  previewStatusFor,
  submitLabel = 'حدّث الحالة وابلّغ المواطنين',
  citizensCount,
  disabledReason,
  compact = false,
  onSubmit,
}: StatusChangeFormProps) {
  const [status, setStatus] = useState(defaultStatus);
  const [note, setNote] = useState('');
  const [statusError, setStatusError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const getTemplate = () => {
    const template = STATUS_TEMPLATES[status];
    if (template === 'assigned') return STATUS_TEMPLATES.assigned;
    if (template === 'resolved') return STATUS_TEMPLATES.resolved;
    return template || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate status
    let hasError = false;
    if (status === currentStatus) {
      setStatusError('اختار حالة غير الحالة الحالية');
      hasError = true;
    } else {
      setStatusError('');
    }

    // Validate note
    if (!note.trim()) {
      setNoteError('اكتب رسالة للمواطنين');
      hasError = true;
    } else {
      setNoteError('');
    }

    if (hasError) {
      // Move focus to first invalid field
      if (status === currentStatus) {
        const select = (e.currentTarget as HTMLFormElement).querySelector(
          '[id="st"]',
        ) as HTMLInputElement;
        select?.focus();
      } else {
        const textarea = (e.currentTarget as HTMLFormElement).querySelector(
          '[id="note"]',
        ) as HTMLTextAreaElement;
        textarea?.focus();
      }
      return;
    }

    try {
      setBusy(true);
      await onSubmit({ status, note });
      // Reset form on success
      setNote('');
      setStatus(currentStatus);
      setStatusError('');
      setNoteError('');
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast.success('اتحدّثت الحالة. المواطنين هيشوفوا رسالتك في التتبع.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حصلت مشكلة. جرّب تاني.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (disabledReason) {
    return (
      <div>
        <Notice tone="gold">{disabledReason}</Notice>
      </div>
    );
  }

  return (
    <form className="side-form" noValidate onSubmit={handleSubmit}>
      <SelectField
        id="st"
        label="الحالة الجديدة"
        options={options}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setStatusError('');
        }}
        error={statusError}
      />
      <TextArea
        id="note"
        label="رسالة للمواطنين"
        value={note}
        onChange={(v) => {
          setNote(v);
          setNoteError('');
        }}
        maxLength={500}
        error={noteError}
        rows={compact ? 2 : undefined}
        help={!compact ? 'بتظهر في تتبع البلاغ. اكتبها قصيرة وفيها اللي هيحصل بعد كده.' : undefined}
      />
      {!note && !compact && (
        <div className="chips" role="group" aria-label="رسايل جاهزة">
          {getTemplate() && (
            <button
              type="button"
              className="ftc-filter"
              onClick={() => setNote(getTemplate())}
            >
              {getTemplate()}
            </button>
          )}
        </div>
      )}
      {!compact && <CitizenPreview status={previewStatusFor(status)} note={note} />}
      {citizensCount && (
        <Checkbox
          id="notify"
          checked
          disabled
          label={`ابعتها للـ ${citizensCount} مواطنين على واتساب (أو SMS)`}
        />
      )}
      <Button type="submit" block loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
