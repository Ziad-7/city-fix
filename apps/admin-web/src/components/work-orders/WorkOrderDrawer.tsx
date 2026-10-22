'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Drawer,
  KvList,
  SelectField,
  Button,
  Notice,
  StatusChip,
  Tag,
  Timeline,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/Icon';
import { StatusChangeForm } from '@/components/incidents/StatusChangeForm';
import type { WorkOrder, WorkOrderTask } from '@/domain/admin-types';
import { patchWorkOrder } from '@/services/workOrders';
import { getTeams } from '@/services/departments';
import { formatDayWithTime, formatEgp } from '@/lib/format';
import { priorityLevel } from '@/logic/priority';
import type { IncidentStatus } from '@/domain/types';

const WORK_ORDER_STATUSES: Record<string, string> = {
  open: 'اتسلّم',
  assigned: 'اتوزّع',
  in_progress: 'شغالين عليه',
  done: 'اتحلّت',
};

function previewStatusFor(status: string): IncidentStatus {
  // Map work order status to incident status for preview
  const map: Record<string, IncidentStatus> = {
    open: 'received',
    assigned: 'assigned',
    in_progress: 'in_progress',
    done: 'resolved',
  };
  return map[status] || 'received';
}

export interface WorkOrderDrawerProps {
  open: boolean;
  workOrder?: WorkOrder;
  onClose: () => void;
}

export function WorkOrderDrawer({ open, workOrder, onClose }: WorkOrderDrawerProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(workOrder?.team);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    enabled: open && !!workOrder?.department,
  });

  const handleTaskToggle = async (index: number) => {
    if (!workOrder) return;
    const newTasks = workOrder.tasks.map((t, i) => (i === index ? { ...t, done: !t.done } : t));

    try {
      await patchWorkOrder(workOrder.id, { tasks: newTasks });
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    } catch {
      toast.error('مقدرناش نحفظ المهمة. جرّب تاني.');
    }
  };

  const handleStatusChange = async ({ status, note }: { status: string; note: string }) => {
    if (!workOrder) return;
    const updateData: { status: string; team?: string; teamSize?: number; note: string } = { status, note };
    if (selectedTeam && status === 'assigned') {
      const team = teams.find((t) => t.name === selectedTeam);
      if (team) {
        updateData.team = team.name;
        updateData.teamSize = team.size;
      }
    }
    await patchWorkOrder(workOrder.id, updateData);
    await queryClient.invalidateQueries({ queryKey: ['work-order', workOrder.id] });
    await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
  };

  if (!workOrder) return null;

  const departmentTeams = teams.filter((t) => t.department === workOrder.department);
  const isOpenStatus = workOrder.status === 'open';
  const isDone = workOrder.status === 'done';

  const kvItems = [
    {
      label: workOrder.incidentId ? 'البلاغ' : 'الطلب',
      value: (
        <div>
          <Link href={workOrder.incidentId ? `/incidents/${workOrder.incidentId}` : `/service-requests/${workOrder.serviceRequestId}`}>
            {workOrder.incidentId ?? workOrder.serviceRequestId}
          </Link>
          {workOrder.followers && <span> · {workOrder.followers} مواطنين</span>}
        </div>
      ),
    },
    {
      label: 'الجهة',
      value: workOrder.department,
    },
    {
      label: 'الفريق',
      value: workOrder.team || 'لسه من غير فريق',
    },
    {
      label: 'المشرف',
      value: workOrder.supervisor || '—',
    },
    {
      label: 'التسليم',
      value: formatDayWithTime(workOrder.dueAt),
      numeric: false,
    },
    {
      label: 'تكلفة تقديرية',
      value: formatEgp(workOrder.estimatedCostEgp),
      numeric: true,
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      titleId="dr-t"
      ariaLabel={`تفاصيل أمر الشغل ${workOrder.id}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
        {/* Header */}
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h2 className="sec-title" id="dr-t" style={{ fontSize: 22, lineHeight: '32px' }}>
              {workOrder.id}
            </h2>
            <p className="sec-sub">{workOrder.title}</p>
          </div>
          <button
            className="close"
            aria-label="اقفل"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Chips and Status */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0' }}>
          <StatusChip kind="workorder" status={workOrder.status} />
          {workOrder.priorityScore && (
            <Tag tone={priorityLevel(workOrder.priorityScore) === 'critical' ? 'danger' : 'gold'}>
              أولوية {priorityLevel(workOrder.priorityScore)} · {workOrder.priorityScore}
            </Tag>
          )}
          {workOrder.external && <Tag tone="ext">جهة خارجية</Tag>}
        </div>

        {/* KvList */}
        <KvList items={kvItems} />

        <hr className="ftc-divider hr0" style={{ margin: '16px 0' }} />

        {/* Tasks */}
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>المهام</h3>
        <ul className="tasks" style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
          {workOrder.tasks.map((task, idx) => (
            <li key={idx} className={task.done ? 'done' : ''}>
              <button
                type="button"
                className="task"
                role="checkbox"
                aria-checked={task.done}
                onClick={() => handleTaskToggle(idx)}
                disabled={isDone}
              >
                <span className="box">{task.done && <Icon name="check" size={14} />}</span>
                {task.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Form or Done Notice */}
        {isDone ? (
          <Notice>الأمر ده اتحلّ خلاص.</Notice>
        ) : (
          <StatusChangeForm
            kind="workorder"
            currentStatus={workOrder.status}
            options={Object.entries(WORK_ORDER_STATUSES).map(([value, label]) => ({
              value,
              label,
            }))}
            previewStatusFor={previewStatusFor}
            citizensCount={workOrder.followers}
            compact
            onSubmit={handleStatusChange}
          />
        )}

        {/* Team selection for open orders */}
        {isOpenStatus && !workOrder.external && (
          <div style={{ marginTop: 12 }}>
            <SelectField
              id="team"
              label="الفريق"
              value={selectedTeam || ''}
              onChange={setSelectedTeam}
              options={[
                { value: '', label: 'من غير فريق' },
                ...departmentTeams.map((t) => ({ value: t.name, label: t.name })),
              ]}
            />
          </div>
        )}

        {/* Updates Timeline */}
        {workOrder.updates.length > 0 && (
          <>
            <hr className="ftc-divider hr0" style={{ margin: '16px 0' }} />
            <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>آخر تحديثات</h3>
            <Timeline
              items={[...workOrder.updates].reverse().map((update, idx) => ({
                id: `update-${idx}`,
                title: update.note,
                who: `${update.at} · ${update.actor}`,
                state: 'done',
              }))}
            />
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <Button
            variant="secondary"
            size="sm"
            className="block"
            href={workOrder.incidentId ? `/incidents/${workOrder.incidentId}` : `/service-requests/${workOrder.serviceRequestId}`}
          >
            {workOrder.incidentId ? 'افتح البلاغ' : 'افتح الطلب'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
