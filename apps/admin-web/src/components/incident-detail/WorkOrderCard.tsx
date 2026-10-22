'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHead } from '@/components/ui/Card';
import { KvList } from '@/components/ui/KvList';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/FormFields';
import { Notice } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { createWorkOrder } from '@/services/workOrders';
import { formatDayDM, formatDueLabel, hoursLateOf } from '@/lib/format';
import { WORK_ORDER_LABEL_AR } from '@/lib/text';
import type { AdminIncident, Department, WorkOrder } from '@/domain/admin-types';
import { getCategory } from '@/domain/categories';

interface WorkOrderCardProps {
  incident: AdminIncident;
  workOrder?: WorkOrder;
  departments: Department[];
  teams: any[];
  canAct: boolean;
  disabledReason?: string;
}

export default function WorkOrderCard({
  incident,
  workOrder,
  departments,
  teams: allTeams,
  canAct,
  disabledReason,
}: WorkOrderCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formBusy, setFormBusy] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(incident.department);
  const [selectedTeam, setSelectedTeam] = useState('');

  const category = getCategory(incident.categoryId);
  const dueDate = new Date(incident.dueAt).toISOString().split('T')[0];

  // Get teams for selected department
  const departmentTeams = allTeams
    .filter((t) => t.department === selectedDepartment)
    .map((t) => ({
      name: t.name,
      size: t.size,
    }));

  const getDepartmentLabel = (dept: Department) => {
    if (dept.external) {
      return `${dept.nameAr} · جهة خارجية · ${dept.externalHotline}`;
    }
    return `${dept.nameAr} (الحي)`;
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedDept = departments.find((d) => d.id === selectedDepartment);
    if (!selectedDept) return;

    if (selectedDept.external) {
      // External department - no form needed
      try {
        setFormBusy(true);
        const result = await createWorkOrder({
          incidentId: incident.id,
          department: selectedDepartment,
          dueAt: incident.dueAt,
        });

        await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
        await queryClient.invalidateQueries({ queryKey: ['incidents'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        toast.success(`اتعمل أمر الشغل ${result.id}.`);
      } catch (err) {
        const errorMsg = (err as any)?.response?.data?.detail || 'حصلت مشكلة. جرّب تاني.';
        if (errorMsg.includes('بالفعل')) {
          toast.error(errorMsg);
          await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
        } else {
          toast.error(errorMsg);
        }
      } finally {
        setFormBusy(false);
      }
    } else {
      // Internal department - requires team selection
      if (!selectedTeam) {
        toast.error('اختار فريق');
        return;
      }

      try {
        setFormBusy(true);
        const result = await createWorkOrder({
          incidentId: incident.id,
          department: selectedDepartment,
          team: selectedTeam,
          dueAt: incident.dueAt,
        });

        await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
        await queryClient.invalidateQueries({ queryKey: ['incidents'] });
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

        toast.success(`اتعمل أمر الشغل ${result.id}.`);
      } catch (err) {
        const errorMsg = (err as any)?.response?.data?.detail || 'حصلت مشكلة. جرّب تاني.';
        if (errorMsg.includes('بالفعل')) {
          toast.error(errorMsg);
          await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
        } else {
          toast.error(errorMsg);
        }
      } finally {
        setFormBusy(false);
      }
    }
  };

  const selectedDept = departments.find((d) => d.id === selectedDepartment);

  if (workOrder) {
    const woHours = hoursLateOf(workOrder.dueAt);
    const woLabel = formatDueLabel(woHours);

    return (
      <Card labelledBy="h-wo-title">
        <CardHead
          id="h-wo-title"
          icon="wrench"
          title="أمر الشغل"
          subtitle={`${workOrder.id} · ${WORK_ORDER_LABEL_AR[workOrder.status]}`}
        />
        <KvList
          items={[
            { label: 'الفريق', value: workOrder.team ? `${workOrder.team}` : 'لسه من غير فريق' },
            { label: 'المشرف', value: workOrder.supervisor || '—' },
            { label: 'التسليم', value: `${formatDayDM(workOrder.dueAt)} (${woLabel})` },
            { label: 'المهام', value: `${workOrder.tasks.filter((t) => t.done).length} من ${workOrder.tasks.length}` },
          ]}
        />
        <Button variant="secondary" block size="sm" href={`/work-orders?open=${workOrder.id}`} style={{ marginTop: '16px' }}>
          افتح أمر الشغل
        </Button>
      </Card>
    );
  }

  return (
    <Card labelledBy="h-wo-title">
      <CardHead id="h-wo-title" icon="wrench" title="أمر الشغل" subtitle="لسه مفيش أمر شغل للبلاغ ده" />

      <form className="side-form" onSubmit={handleCreateWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SelectField
          id="dep"
          label="الجهة"
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          options={departments.map((d) => ({
            value: d.id,
            label: getDepartmentLabel(d),
          }))}
          disabled={!canAct}
        />

        {selectedDept?.external ? (
          <Notice tone="gold" icon="alert-triangle">
            جهة خارجية · الخط الساخن {selectedDept.externalHotline}. هنبلّغهم ونتابع.
          </Notice>
        ) : (
          <SelectField
            id="as"
            label="الفريق المسؤول"
            value={selectedTeam}
            onChange={setSelectedTeam}
            options={[
              { value: '', label: 'من غير فريق (هنوزّعه بعدين)' },
              ...departmentTeams.map((t) => ({
                value: t.name,
                label: `${t.name} · ${t.size} أفراد · متاح`,
              })),
            ]}
            disabled={!canAct}
          />
        )}

        <TextField
          id="due"
          label="ميعاد التسليم"
          value={formatDayDM(incident.dueAt)}
          onChange={() => {}}
          readOnly
          help={`محسوب من هدف الاستجابة للنوع ده: ${category.targetDays} أيام عمل.`}
        />

        <Button type="submit" block loading={formBusy} disabled={!canAct || formBusy}>
          أنشئ أمر شغل
        </Button>
      </form>
    </Card>
  );
}
