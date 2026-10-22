'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHead, FilterChip, Card, EmptyState, ErrorState, Button } from '@/components/ui';
import { KanbanColumn } from '@/components/work-orders/KanbanColumn';
import { WorkOrderCard } from '@/components/work-orders/WorkOrderCard';
import { WorkOrderDrawer } from '@/components/work-orders/WorkOrderDrawer';
import { getWorkOrders, getWorkOrder } from '@/services/workOrders';
import { getDepartments } from '@/services/departments';
import { useSession } from '@/lib/session';
import type { WorkOrder, WorkOrderStatus } from '@/domain/admin-types';
import { formatNumber } from '@/lib/format';

const STATUSES: WorkOrderStatus[] = ['open', 'assigned', 'in_progress', 'done'];

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'اتسلّم',
  assigned: 'اتوزّع',
  in_progress: 'شغالين عليه',
  done: 'اتحلّت',
};

export default function WorkOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const openParam = searchParams?.get('open');

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (openParam) {
      setSelectedId(openParam);
    }
  }, [openParam]);

  const { data: workOrders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['work-orders', selectedDepartment],
    queryFn: () =>
      getWorkOrders({
        status: undefined,
        department: selectedDepartment || undefined,
      }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    staleTime: Infinity,
  });
  const { data: selectedWorkOrder } = useQuery<WorkOrder | undefined>({
    queryKey: ['work-order', selectedId],
    queryFn: () => (selectedId ? getWorkOrder(selectedId) : undefined),
    enabled: !!selectedId,
  });

  // Filter orders - done ones only from last 7 days
  const filteredOrders = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    return workOrders.filter((wo) => {
      if (wo.status === 'done') {
        return wo.resolvedAt && new Date(wo.resolvedAt).getTime() > sevenDaysAgo;
      }
      return true;
    });
  }, [workOrders, now]);

  // Group by status and sort
  const grouped = useMemo(() => {
    const result: Record<WorkOrderStatus, WorkOrder[]> = {
      open: [],
      assigned: [],
      in_progress: [],
      done: [],
    };

    filteredOrders.forEach((wo) => {
      result[wo.status].push(wo);
    });

    // Sort: late first, then by dueAt
    Object.keys(result).forEach((status) => {
      result[status as WorkOrderStatus].sort((a, b) => {
        const aLate = a.overdue && a.status !== 'done' ? 0 : 1;
        const bLate = b.overdue && b.status !== 'done' ? 0 : 1;
        if (aLate !== bLate) return aLate - bLate;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    });

    return result;
  }, [filteredOrders]);

  const totalCount = filteredOrders.length;
  const lateCount = filteredOrders.filter((wo) => wo.overdue && wo.status !== 'done').length;
  const lateText = lateCount > 0 ? `${formatNumber(lateCount)} متأخرين` : 'مفيش متأخر';

  const handleOpenWorkOrder = (id: string) => {
    setSelectedId(id);
    router.push(`?open=${id}`);
  };

  const handleCloseDrawer = () => {
    setSelectedId(null);
    router.push('');
  };

  if (!session) return null;

  return (
    <main className="ftc-admin-main">
      <div className="page">
        <PageHead
          title="أوامر الشغل"
          subtitle={`لوحة المتابعة · ${formatNumber(totalCount)} أمر شغل · ${lateText}`}
        />

        {/* Department filters */}
        {session.role === 'admin' && (
          <div role="group" aria-label="فلتر الجهة" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FilterChip
              label="الكل"
              pressed={selectedDepartment === null}
              onClick={() => setSelectedDepartment(null)}
            />
            {departments.map((dept) => (
              <FilterChip
                key={dept.id}
                label={dept.nameAr}
                pressed={selectedDepartment === dept.id}
                onClick={() => setSelectedDepartment(dept.id)}
              />
            ))}
          </div>
        )}

        {/* Kanban board */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {STATUSES.map((status) => (
              <Card key={status}>
                <div style={{ height: 200, background: '#f5f5f5', animation: 'pulse 2s' }} />
              </Card>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message="حصلت مشكلة في تحميل أوامر الشغل"
            action={
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                جرّب تاني
              </Button>
            }
          />
        ) : totalCount === 0 ? (
          <EmptyState
            icon="wrench"
            title="مفيش أوامر شغل"
            message="أنشئ أمر شغل من صفحة البلاغ."
          />
        ) : (
          <div className="board-wrap">
            <div className="board">
              {STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  title={STATUS_LABELS[status]}
                  count={grouped[status].length}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {grouped[status].map((wo) => (
                      <WorkOrderCard
                        key={wo.id}
                        wo={wo}
                        selected={selectedId === wo.id}
                        now={now}
                        onOpen={handleOpenWorkOrder}
                      />
                    ))}
                  </div>
                </KanbanColumn>
              ))}
            </div>
          </div>
        )}

        {/* Drawer */}
        <WorkOrderDrawer
          open={!!selectedId && !!selectedWorkOrder}
          workOrder={selectedWorkOrder}
          onClose={handleCloseDrawer}
        />
      </div>
    </main>
  );
}
