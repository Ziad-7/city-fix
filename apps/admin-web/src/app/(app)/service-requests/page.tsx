'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { getServiceRequests, patchServiceRequest } from '@/services/serviceRequests';
import {
  PageHead,
  KpiCard,
  FilterChip,
  SelectField,
  DataTable,
  Button,
  ErrorState,
  EmptyState,
  Skeleton,
  StatusChip,
  TextArea,
  Modal,
  TextField,
  Card,
} from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ui/Toast';
import { formatDayDM, formatSlot, formatLongDate, formatRelative } from '@/lib/format';
import type { AdminServiceRequest } from '@/domain/admin-types';
import type { AdminIconName } from '@/components/admin-icon-shapes';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  bulky_waste: 'رفع مخلفات كبيرة',
  tree_maintenance: 'صيانة أشجار',
};

const SERVICE_TYPE_ICONS: Record<string, AdminIconName> = {
  bulky_waste: 'trash',
  tree_maintenance: 'tree',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'كاش مع العامل',
  fawry: 'فوري',
  instapay: 'إنستاباي',
  wallet: 'محفظة موبايل',
};

const TEAM_OPTIONS: Record<string, string[]> = {
  bulky_waste: [
    'عربية نظافة 7 · 3 أفراد',
    'عربية نظافة 4',
    'فريق مخلفات البناء 1',
  ],
  tree_maintenance: [
    'فريق الحدائق 1',
  ],
};

interface FilterState {
  type?: string;
  payment?: string;
  status?: string;
}

export default function ServiceRequestsPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FilterState>({});
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('open'));
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleSlot, setScheduleSlot] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  const { data: requests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => getServiceRequests(),
  });

  const patchMutation = useMutation({
    mutationFn: (data: { id: string; status?: string; day?: string; slot?: string; assignee?: string; note?: string }) =>
      patchServiceRequest(data.id, {
        status: data.status,
        day: data.day,
        slot: data.slot,
        assignee: data.assignee,
        note: data.note,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('اتحدّث الطلب.');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'حصلت مشكلة. جرّب تاني.';
      toast.error(message);
    },
  });

  const now = useMemo(() => new Date(), []);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const newCount = requests.filter(r => r.status === 'received').length;
    const todayCount = requests.filter(r => {
      const today = now.toISOString().split('T')[0];
      return r.details.day === today && r.status === 'in_progress';
    }).length;
    const pendingPaymentCount = requests.filter(
      r => ['fawry', 'instapay', 'wallet'].includes(r.details.payment) && !r.paid && !['resolved', 'closed'].includes(r.status),
    ).length;
    const resolvedThisWeekCount = requests.filter(r => {
      if (r.status !== 'resolved' && r.status !== 'closed') return false;
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return new Date(r.details.day) >= weekAgo;
    }).length;

    return { newCount, todayCount, pendingPaymentCount, resolvedThisWeekCount };
  }, [requests, now]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (filters.type && r.serviceType !== filters.type) return false;
      if (filters.payment && r.details.payment !== filters.payment) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    });
  }, [requests, filters]);

  const selected = requests.find(r => r.id === selectedId);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: requests.length,
      bulky_waste: 0,
      tree_maintenance: 0,
      today: 0,
    };
    requests.forEach(r => {
      counts[r.serviceType]++;
      const today = now.toISOString().split('T')[0];
      if (r.details.day === today) counts.today++;
    });
    return counts;
  }, [requests, now]);

  const handleScheduleChange = async () => {
    if (!selected || !scheduleDay || !scheduleSlot) {
      toast.error('اختار يوم وفترة');
      return;
    }
    await patchMutation.mutateAsync({
      id: selected.id,
      day: scheduleDay,
      slot: scheduleSlot,
      note: scheduleNote || undefined,
    });
    setScheduleModalOpen(false);
    setScheduleDay('');
    setScheduleSlot('');
    setScheduleNote('');
  };

  const handleAssign = async (assignee: string) => {
    if (!selected) return;
    await patchMutation.mutateAsync({
      id: selected.id,
      assignee,
    });
  };

  return (
    <main className="ftc-admin-main">
      <div className="page">
        <PageHead
          title="طلبات الخدمات"
          subtitle={`CityServe · رفع مخلفات كبيرة وصيانة أشجار بميعاد · ${formatLongDate(now.getTime())}`}
        />

        <div className="mini-kpis">
          <KpiCard label="طلبات جديدة" value={kpis.newCount} note="محتاجة جدولة" />
          <KpiCard label="متجدولة النهارده" value={kpis.todayCount} note={`${kpis.todayCount} جاري التنفيذ`} />
          <KpiCard label="مستنية تأكيد دفع" value={kpis.pendingPaymentCount} note="فوري وإنستاباي" />
          <KpiCard label="اتنفّذت الأسبوع ده" value={kpis.resolvedThisWeekCount} note="" />
        </div>

        <div className="fbar" role="group" aria-label="فلاتر">
          <div className="chips">
            <FilterChip
              pressed={!filters.type}
              onClick={() => setFilters({ ...filters, type: undefined })}
              count={typeCounts.all}
            >
              الكل
            </FilterChip>
            <FilterChip
              pressed={filters.type === 'bulky_waste'}
              onClick={() => setFilters({ ...filters, type: 'bulky_waste' })}
              count={typeCounts.bulky_waste}
            >
              رفع مخلفات كبيرة
            </FilterChip>
            <FilterChip
              pressed={filters.type === 'tree_maintenance'}
              onClick={() => setFilters({ ...filters, type: 'tree_maintenance' })}
              count={typeCounts.tree_maintenance}
            >
              صيانة أشجار
            </FilterChip>
            <FilterChip
              pressed={filters.type === 'today'}
              onClick={() => setFilters({ ...filters, type: 'today' })}
              count={typeCounts.today}
            >
              النهارده
            </FilterChip>
          </div>
          <div className="selects">
            <SelectField
              label="طريقة الدفع"
              id="payment"
              value={filters.payment || ''}
              onChange={(v) => setFilters({ ...filters, payment: v || undefined })}
              options={[
                { value: '', label: 'كل طرق الدفع' },
                { value: 'cash', label: 'كاش مع العامل' },
                { value: 'fawry', label: 'فوري' },
                { value: 'instapay', label: 'إنستاباي' },
                { value: 'wallet', label: 'محفظة موبايل' },
              ]}
            />
            <SelectField
              label="الحالة"
              id="status"
              value={filters.status || ''}
              onChange={(v) => setFilters({ ...filters, status: v || undefined })}
              options={[
                { value: '', label: 'كل الحالات' },
                { value: 'received', label: 'وصل' },
                { value: 'triaged', label: 'اتصنّف' },
                { value: 'assigned', label: 'اتحوّل' },
                { value: 'in_progress', label: 'جاري التنفيذ' },
                { value: 'resolved', label: 'اتصلّح' },
              ]}
            />
          </div>
        </div>

        <div className="sr-layout">
          <Card className="sr-table-card">
            {isLoading ? (
              <Skeleton variant="table" rows={6} />
            ) : error ? (
              <ErrorState variant="error" action={<Button secondary onClick={() => refetch()}>جرّب تاني</Button>} />
            ) : filteredRequests.length === 0 ? (
              <EmptyState
                icon="truck"
                title={requests.length === 0 ? 'مفيش طلبات خدمات' : 'مفيش طلبات بالفلاتر دي'}
                message={requests.length === 0 ? 'الطلبات الجديدة هتظهر هنا.' : 'غيّر الفلاتر أو امسحها.'}
                action={requests.length > 0 ? <Button secondary sm onClick={() => setFilters({})}>امسح الفلاتر</Button> : undefined}
              />
            ) : (
              <DataTable
                ariaLabel="طلبات الخدمات"
                columns={[
                  {
                    id: 'request',
                    header: 'الطلب',
                    cell: (row: AdminServiceRequest) => (
                      <div className="type">
                        <span className="ftc-icon-well">
                        <Icon name={SERVICE_TYPE_ICONS[row.serviceType]} size={18} />
                        </span>
                        <div>
                          <span className="strong num">{row.id}</span>
                          <span className="mini" style={{ display: 'block' }}>
                            {SERVICE_TYPE_LABELS[row.serviceType]}
                          </span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'location',
                    header: 'العنوان والجهة',
                    cell: (row: AdminServiceRequest) => (
                      <div>
                        {row.location.address}
                        <span className="mini" style={{ display: 'block' }}>
                          {row.department}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'schedule',
                    header: 'اليوم والفترة',
                    cell: (row: AdminServiceRequest) => (
                      <div>
                        {formatDayDM(row.details.day, now.getTime())}
                        <span className="mini num" style={{ display: 'block' }}>
                          {formatSlot(row.details.slot)}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'payment',
                    header: 'الدفع',
                    cell: (row: AdminServiceRequest) => (
                      <div>
                        {PAYMENT_LABELS[row.details.payment]}
                        {row.paid && row.details.payment !== 'cash' && ' · مدفوع'}
                        {!row.paid && row.details.payment !== 'cash' && ' · مستنية الدفع'}
                      </div>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'الحالة',
                    cell: (row: AdminServiceRequest) => <StatusChip status={row.status} kind="incident" />,
                  },
                ]}
                rows={filteredRequests}
                getRowId={(row) => row.id}
                onSelect={(row) => setSelectedId(row.id)}
                selectedId={selectedId}
              />
            )}
          </Card>

          <aside className="ftc-card" aria-labelledby="h-sel">
            {selected ? (
              <>
                <div className="card-head">
                  <h2 className="sec-title" id="h-sel">
                    {selected.id}
                  </h2>
                  <p className="sec-sub">
                    {SERVICE_TYPE_LABELS[selected.serviceType]} · {selected.department}
                  </p>
                  <StatusChip status={selected.status} kind="incident" />
                </div>

                <h3 className="strong" style={{ margin: '0 0 8px', fontSize: '14px' }}>
                  {selected.serviceType === 'tree_maintenance' ? 'الشغل المطلوب' : 'اللي محتاج يترفع'}
                </h3>
                <ul className="items">
                  {selected.details.items.map((item, idx) => (
                    <li key={idx}>
                      <Icon name="check" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                {selected.details.note && (
                  <p className="small" style={{ margin: '10px 0 0' }}>
                    <span className="ftc-muted">ملحوظة المواطن:</span> {selected.details.note}
                  </p>
                )}

                <hr className="ftc-divider" />

                <div className="kvlist">
                  <div className="kv">
                    <span className="k">العنوان</span>
                    <span className="v">{selected.location.address}</span>
                  </div>
                  <div className="kv">
                    <span className="k">الميعاد</span>
                    <span className="v">
                      {formatDayDM(selected.details.day)} · {formatSlot(selected.details.slot)}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">الدفع</span>
                    <span className="v">{PAYMENT_LABELS[selected.details.payment]}</span>
                  </div>
                  <div className="kv">
                    <span className="k">الرسم</span>
                    <span className="v">حسب لائحة الحي</span>
                  </div>
                  <div className="kv">
                    <span className="k">المواطن</span>
                    <span className="v">مواطن</span>
                  </div>
                </div>

                <hr className="ftc-divider" />

                <div className="cap">
                  <div className="row-between">
                    <span className="strong" style={{ fontSize: '14px' }}>
                      {selected.details.slot}
                    </span>
                    <span className="mini num">0 من 6 طلبات</span>
                  </div>
                  <span className="ftc-bar ftc-bar--gold" role="img" aria-label="0 من 6">
                    <span style={{ width: '0%' }} />
                  </span>
                  <span className="mini">فاضل 6 على {selected.assignee || 'العربية'}.</span>
                </div>

                <form className="side-form" style={{ marginTop: '14px' }}>
                  <SelectField
                    id="status"
                    label="الحالة"
                    value={selected.status}
                    onChange={() => {}}
                    options={[
                      { value: 'received', label: 'وصل' },
                      { value: 'triaged', label: 'اتصنّف' },
                      { value: 'assigned', label: 'اتحوّل' },
                      { value: 'in_progress', label: 'جاري التنفيذ' },
                      { value: 'resolved', label: 'اتصلّح' },
                    ]}
                  />

                  <SelectField
                    id="truck"
                    label="العربية أو الفريق"
                    value={selected.assignee || ''}
                    onChange={(v) => handleAssign(v)}
                    options={TEAM_OPTIONS[selected.serviceType]?.map(t => ({ value: t, label: t })) || []}
                  />

                  <TextArea id="note" label="رسالة للمواطن" value="" onChange={() => {}} />

                  <div className="btn-split">
                    <Button primary sm icon="truck">
                      جدوِل العربية
                    </Button>
                    <Button secondary sm onClick={() => setScheduleModalOpen(true)}>
                      غيّر الميعاد
                    </Button>
                    <Button secondary sm icon="send">
                      ابعت رسالة للمواطن
                    </Button>
                  </div>
                </form>

                <hr />

                <h3 className="strong" style={{ margin: '0 0 10px', fontSize: '14px' }}>
                  السجل
                </h3>
                <div className="timeline">
                  {selected.timeline && selected.timeline.map((entry, idx) => (
                    <div key={idx} className="entry">
                      <div className="who">{formatRelative(entry.at)} · {entry.actor}</div>
                      <div className="title">{entry.note}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon="truck" title="اختار طلب من القائمة" />
            )}
          </aside>
        </div>

        <Modal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} title="غيّر الميعاد">
          <form>
            <TextField
              type="date"
              label="اليوم"
              id="day"
              value={scheduleDay}
              onChange={setScheduleDay}
            />
            <SelectField
              label="الفترة"
              id="slot"
              value={scheduleSlot}
              onChange={setScheduleSlot}
              options={[
                { value: 'morning', label: '9 ص – 12 ظ' },
                { value: 'afternoon', label: '2 م – 5 م' },
              ]}
            />
            <TextArea
              label="رسالة للمواطن (اختياري)"
              id="note"
              value={scheduleNote}
              onChange={setScheduleNote}
            />
            <div className="modal-actions">
              <Button primary onClick={handleScheduleChange}>
                احفظ الميعاد
              </Button>
              <Button secondary onClick={() => setScheduleModalOpen(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </main>
  );
}
