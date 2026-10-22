'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchServiceRequest } from '@/services/serviceRequests';
import {
  Button,
  KvList,
  Modal,
  SelectField,
  StatusChip,
  TextArea,
  TextField,
  Timeline,
  useToast,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { StatusChangeForm } from '@/components/incidents/StatusChangeForm';
import type { AdminServiceRequest } from '@/domain/admin-types';
import { STATUS_LABEL_AR, type IncidentStatus } from '@/domain/types';
import { SERVICE_TYPE_LABEL_AR } from '@/lib/text';
import { formatDayDM, formatSlot, formatSpots, formatWhen } from '@/lib/format';
import { CAP, TRUCKS, bookedCount, paymentLabel } from './sr-utils';

type PatchData = { status?: string; day?: string; slot?: string; assignee?: string; note?: string };

const STATUS_OPTIONS = (['received', 'assigned', 'in_progress', 'resolved'] as const).map((s) => ({
  value: s,
  label: STATUS_LABEL_AR[s],
}));

const normalize = (s: IncidentStatus): IncidentStatus => (s === 'triaged' ? 'received' : s === 'closed' ? 'resolved' : s);

export function SrDetailPanel({ request, all }: { request: AdminServiceRequest; all: AdminServiceRequest[] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [truck, setTruck] = useState(request.assignee ?? '');
  const [truckError, setTruckError] = useState('');
  const [modal, setModal] = useState<'date' | 'message' | null>(null);
  const [day, setDay] = useState(request.details.day);
  const [slot, setSlot] = useState<string>(request.details.slot);
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: PatchData) => patchServiceRequest(request.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const run = async (data: PatchData, successMsg: string | null): Promise<boolean> => {
    try {
      await mutation.mutateAsync(data);
      if (successMsg) toast.success(successMsg);
      return true;
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'حصلت مشكلة. جرّب تاني.');
      return false;
    }
  };

  const current = normalize(request.status);
  const isTree = request.serviceType === 'tree_maintenance';
  const typeLabel = SERVICE_TYPE_LABEL_AR[request.serviceType];
  const booked = bookedCount(all, request.details.day, request.details.slot);
  const full = booked >= CAP;
  const left = Math.max(0, CAP - booked);
  const weekday = formatDayDM(request.details.day).split(' ')[0];
  const slotShort = request.details.slot === 'morning' ? 'الصبح' : 'بعد الضهر';
  const trucks = TRUCKS[request.serviceType];

  const timeline = [
    ...request.timeline.map((t, i) => ({
      id: `t${i}`,
      title: t.note || STATUS_LABEL_AR[t.status],
      who: `${formatWhen(t.at)} · ${t.actor}`,
      state: 'done' as const,
    })),
    ...(current === 'received'
      ? [{ id: 'pending', title: 'في انتظار تحديد العربية', who: 'دلوقتي', state: 'current' as const }]
      : []),
  ];

  const assignOnly = async () => {
    if (!truck) {
      setTruckError('اختار الفريق أو العربية');
      return;
    }
    setTruckError('');
    await run({ assignee: truck }, `اتحدّث الطلب ${request.id}.`);
  };

  const saveDate = async () => {
    if (!day) {
      setFieldError('اختار يوم');
      return;
    }
    const ok = await run({ day, slot, ...(note.trim() ? { note: note.trim() } : {}) }, `اتحدّث الطلب ${request.id}.`);
    if (ok) closeModal();
  };

  const sendMessage = async () => {
    if (!note.trim()) {
      setFieldError('اكتب رسالة للمواطن');
      return;
    }
    const ok = await run({ note: note.trim() }, 'اتبعتت الرسالة للمواطن.');
    if (ok) closeModal();
  };

  const closeModal = () => {
    setModal(null);
    setNote('');
    setFieldError('');
  };

  return (
    <aside className="ftc-card" aria-labelledby="h-sel">
      <div className="card-head">
        <div>
          <h2 className="sec-title" id="h-sel">
            {request.id}
          </h2>
          <p className="sec-sub">
            {typeLabel} · {request.department}
          </p>
        </div>
        <StatusChip kind="incident" status={request.status} />
      </div>

      <h3 className="strong" style={{ margin: '0 0 8px', fontSize: 14 }}>
        {isTree ? 'الشغل المطلوب' : 'اللي محتاج يترفع'}
      </h3>
      <ul className="items">
        {request.details.items.map((item, idx) => (
          <li key={idx}>
            <Icon name="check" size={16} />
            {item}
          </li>
        ))}
      </ul>
      {request.details.note && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          <span className="ftc-muted">ملحوظة المواطن:</span> {request.details.note}
        </p>
      )}

      <hr className="ftc-divider" />
      <KvList
        items={[
          { label: 'العنوان', value: request.location.address },
          { label: 'الميعاد', value: `${formatDayDM(request.details.day)} · ${formatSlot(request.details.slot)}` },
          { label: 'الدفع', value: paymentLabel(request) },
          { label: 'الرسم', value: 'حسب لائحة الحي' },
          { label: 'المواطن', value: 'مواطن' },
        ]}
      />

      <hr className="ftc-divider" />
      <div className="cap">
        <div className="row-between">
          <span className="strong" style={{ fontSize: 14 }}>
            {weekday} {slotShort}
          </span>
          <span className="mini num">
            {booked} من {CAP} طلبات
          </span>
        </div>
        <span className="ftc-bar ftc-bar--gold" role="img" aria-label={`${booked} من ${CAP}`}>
          <span style={{ width: `${Math.min(100, (booked / CAP) * 100)}%` }} />
        </span>
        {full ? (
          <span className="mini late-cell">الفترة دي كاملة</span>
        ) : (
          <span className="mini">
            فاضل {formatSpots(left)} على {request.assignee ?? 'العربية'}.
          </span>
        )}
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SelectField
          id="truck"
          label="العربية أو الفريق"
          value={truck}
          error={truckError || undefined}
          onChange={(v) => {
            setTruck(v);
            setTruckError('');
          }}
          options={[{ value: '', label: 'اختار العربية أو الفريق' }, ...trucks.map((t) => ({ value: t, label: t }))]}
        />

        <StatusChangeForm
          key={`${request.id}-${request.status}`}
          kind="service"
          currentStatus={current}
          defaultStatus={current === 'received' ? 'assigned' : current}
          options={STATUS_OPTIONS}
          previewStatusFor={(v) => v as IncidentStatus}
          submitLabel={current === 'received' ? 'جدوِل العربية' : 'حدّث الحالة وابلّغ المواطن'}
          onSubmit={async ({ status, note: msg }) => {
            if (status === 'assigned' && !truck) {
              setTruckError('اختار الفريق أو العربية');
              throw new Error('اختار الفريق أو العربية');
            }
            await mutation.mutateAsync({ status, note: msg, ...(truck ? { assignee: truck } : {}) });
          }}
        />

        <div className="btn-split">
          <Button variant="secondary" size="sm" type="button" onClick={assignOnly} disabled={mutation.isPending}>
            وزّع على فريق
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              setDay(request.details.day);
              setSlot(request.details.slot);
              setModal('date');
            }}
          >
            غيّر الميعاد
          </Button>
        </div>
        <Button variant="ghost" size="sm" icon="send" type="button" onClick={() => setModal('message')}>
          ابعت رسالة للمواطن
        </Button>
      </div>

      <hr className="ftc-divider" />
      <h3 className="strong" style={{ margin: '0 0 10px', fontSize: 14 }}>
        السجل
      </h3>
      <Timeline items={timeline} />

      <Modal
        open={modal === 'date'}
        onClose={closeModal}
        title="غيّر الميعاد"
        busy={mutation.isPending}
        actions={
          <>
            <Button loading={mutation.isPending} onClick={saveDate}>
              احفظ الميعاد
            </Button>
            <Button variant="ghost" onClick={closeModal} disabled={mutation.isPending}>
              إلغاء
            </Button>
          </>
        }
      >
        <div className="side-form">
          <TextField
            id="sr-day"
            type="date"
            label="اليوم"
            value={day}
            error={fieldError || undefined}
            onChange={(v) => {
              setDay(v);
              setFieldError('');
            }}
          />
          <SelectField
            id="sr-slot"
            label="الفترة"
            value={slot}
            onChange={setSlot}
            options={[
              { value: 'morning', label: formatSlot('morning') },
              { value: 'afternoon', label: formatSlot('afternoon') },
            ]}
          />
          <TextArea id="sr-date-note" label="رسالة للمواطن (اختياري)" value={note} onChange={setNote} />
        </div>
      </Modal>

      <Modal
        open={modal === 'message'}
        onClose={closeModal}
        title="ابعت رسالة للمواطن"
        busy={mutation.isPending}
        actions={
          <>
            <Button loading={mutation.isPending} onClick={sendMessage}>
              ابعت
            </Button>
            <Button variant="ghost" onClick={closeModal} disabled={mutation.isPending}>
              إلغاء
            </Button>
          </>
        }
      >
        <TextArea
          id="sr-msg"
          label="رسالة للمواطن"
          value={note}
          error={fieldError || undefined}
          onChange={(v) => {
            setNote(v);
            setFieldError('');
          }}
        />
      </Modal>
    </aside>
  );
}
