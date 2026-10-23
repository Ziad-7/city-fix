'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Modal, Notice, SelectField, TextField, useToast } from '@/components/ui';
import type { CreateBinInput } from '@/domain/admin-types';
import { ApiError } from '@/lib/http';
import { getDepartments } from '@/services/departments';
import { registerBin } from '@/services/bins';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

interface Form {
  id: string;
  name: string;
  lat: string;
  lng: string;
  district: string;
  departmentId: string;
  fullPct: string;
  heatC: string;
  intervalMin: string;
  isSimulated: boolean;
}

const EMPTY: Form = {
  id: '',
  name: '',
  lat: '',
  lng: '',
  district: 'القاهرة',
  departmentId: '',
  fullPct: '80',
  heatC: '60',
  intervalMin: '30',
  isSimulated: false,
};

const num = (v: string): number => (v.trim() === '' ? NaN : Number(v));

/** Returns a field -> message map; empty means valid. */
function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!ID_RE.test(f.id)) e.id = 'حروف إنجليزي وأرقام و - و _ بس (لحد 64)';
  if (!f.name.trim()) e.name = 'اكتب اسم الحاوية';
  const lat = num(f.lat);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) e.lat = 'رقم بين -90 و 90';
  const lng = num(f.lng);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) e.lng = 'رقم بين -180 و 180';
  if (!f.district.trim()) e.district = 'اكتب الحي';
  const full = num(f.fullPct);
  if (!Number.isFinite(full) || full < 0 || full > 100) e.fullPct = 'رقم بين 0 و 100';
  const heat = num(f.heatC);
  if (!Number.isFinite(heat) || heat < -40 || heat > 125) e.heatC = 'رقم بين -40 و 125';
  const every = num(f.intervalMin);
  if (!Number.isInteger(every) || every < 1 || every > 1440) e.intervalMin = 'عدد صحيح بين 1 و 1440';
  return e;
}

export function RegisterBinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<Form>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState('');
  // The device key lives only in this state; it is never cached, stored or logged.
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const departments = useQuery({ queryKey: ['departments'], queryFn: getDepartments, staleTime: Infinity, enabled: open });

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const errors = showErrors ? validate(form) : {};

  const close = () => {
    setForm(EMPTY);
    setShowErrors(false);
    setFormError('');
    setDeviceKey(null);
    setCopied(false);
    setSaved(false);
    onClose();
  };

  const m = useMutation({
    mutationFn: (input: CreateBinInput) => registerBin(input),
    onSuccess: (r) => {
      setDeviceKey(r.deviceKey);
      void qc.invalidateQueries({ queryKey: ['smart-bins'] });
      void qc.invalidateQueries({ queryKey: ['smart-bins-forecast'] });
    },
    onError: (e: Error) => {
      const msg = e instanceof ApiError && e.status === 409 ? 'الرقم ده مستخدم لحاوية تانية' : e.message;
      setFormError(msg);
      toast.error(msg);
    },
  });

  const submit = () => {
    setFormError('');
    setShowErrors(true);
    if (Object.keys(validate(form)).length > 0) return;
    m.mutate({
      id: form.id,
      name: form.name.trim(),
      district: form.district.trim(),
      ...(form.departmentId ? { departmentId: form.departmentId } : {}),
      lat: Number(form.lat),
      lng: Number(form.lng),
      isSimulated: form.isSimulated,
      fullPct: Number(form.fullPct),
      heatC: Number(form.heatC),
      intervalMin: Number(form.intervalMin),
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deviceKey ?? '');
      setCopied(true);
      toast.success('اتنسخ');
    } catch {
      toast.error('مقدرناش ننسخ، انسخه بإيدك');
    }
  };

  if (deviceKey !== null) {
    return (
      <Modal
        open={open}
        onClose={close}
        dismissible={false}
        title="مفتاح الجهاز"
        actions={
          <Button disabled={!saved} onClick={close}>
            تم
          </Button>
        }
      >
        <Notice tone="danger">المفتاح بيظهر مرة واحدة بس. انسخه دلوقتي وحطه في إعدادات الجهاز، ولو ضاع لازم تعمل مفتاح جديد.</Notice>
        <p style={{ margin: '12px 0' }}>
          <code dir="ltr" style={{ display: 'block', padding: 10, background: '#f4f1ea', borderRadius: 8, overflowWrap: 'anywhere' }}>
            {deviceKey}
          </code>
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={() => void copy()}>
            {copied ? 'اتنسخ' : 'نسخ'}
          </Button>
          <Checkbox id="bin-key-saved" label="نسخت المفتاح" checked={saved} onChange={setSaved} />
        </div>
      </Modal>
    );
  }

  const deptOptions = [
    { value: '', label: 'بدون جهة' },
    ...(departments.data ?? []).map((d) => ({ value: d.id, label: d.nameAr })),
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      busy={m.isPending}
      title="تسجيل حاوية"
      actions={
        <>
          <Button loading={m.isPending} onClick={submit}>
            تسجيل
          </Button>
          <Button variant="ghost" disabled={m.isPending} onClick={close}>
            إلغاء
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <TextField id="bin-id" label="رقم الجهاز" dir="ltr" value={form.id} onChange={set('id')} error={errors.id} required />
        <TextField id="bin-name" label="اسم الحاوية" value={form.name} onChange={set('name')} error={errors.name} required />
        <TextField id="bin-lat" label="خط العرض" dir="ltr" value={form.lat} onChange={set('lat')} error={errors.lat} required />
        <TextField id="bin-lng" label="خط الطول" dir="ltr" value={form.lng} onChange={set('lng')} error={errors.lng} required />
        <TextField id="bin-district" label="الحي" value={form.district} onChange={set('district')} error={errors.district} />
        <SelectField id="bin-dept" label="الجهة" value={form.departmentId} onChange={set('departmentId')} options={deptOptions} />
        <TextField id="bin-full" label="نسبة الامتلاء للتنبيه %" dir="ltr" value={form.fullPct} onChange={set('fullPct')} error={errors.fullPct} />
        <TextField id="bin-heat" label="حرارة التنبيه °م" dir="ltr" value={form.heatC} onChange={set('heatC')} error={errors.heatC} />
        <TextField id="bin-interval" label="كل كام دقيقة يبعت" dir="ltr" value={form.intervalMin} onChange={set('intervalMin')} error={errors.intervalMin} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Checkbox id="bin-sim" label="جهاز محاكاة" checked={form.isSimulated} onChange={set('isSimulated')} />
      </div>
      {formError && (
        <p className="ftc-error" role="alert" style={{ marginTop: 12 }}>
          {formError}
        </p>
      )}
    </Modal>
  );
}
