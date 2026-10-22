'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { StatusChip, Button, DangerTag, Card, CardHead, KvList } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Notice, EmptyState, Skeleton } from '@/components/ui/States';
import { PriorityBreakdown } from '@/components/ui/PriorityBreakdown';
import { Timeline } from '@/components/ui/Timeline';
import { StatusChangeForm } from '@/components/incidents/StatusChangeForm';
import type { AdminIncident, WorkOrder, Department, Team, StaffSession, SimilarIncidentMatch } from '@/domain/admin-types';
import { formatDateTime, formatWhen, formatEgp, formatNumber, formatCitizens, formatWorkDays, formatDayDM, formatDueLabel, hoursLateOf, shortAddress } from '@/lib/format';
import { STATUS_LABEL_AR } from '@/domain/types';
import { SEVERITY_AI_AR } from '@/lib/text';
import { getCategory } from '@/domain/categories';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { patchIncident, confirmTriage, mergeIncidents } from '@/services/incidents';
import { createWorkOrder } from '@/services/workOrders';
import AiSuggestionCard from './AiSuggestionCard';
import DuplicateCard from './DuplicateCard';
import PhotosCard from './PhotosCard';
import LinkedReportsCard from './LinkedReportsCard';
import WorkOrderCard from './WorkOrderCard';
import LocationCard from './LocationCard';

interface IncidentDetailContentProps {
  incident: AdminIncident;
  similarIncidents: SimilarIncidentMatch[];
  workOrder?: WorkOrder;
  departments: Department[];
  teams: Team[];
  canAct: boolean;
  session?: StaffSession;
}

export default function IncidentDetailContent({
  incident,
  similarIncidents,
  workOrder,
  departments,
  teams,
  canAct,
  session,
}: IncidentDetailContentProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFormBusy, setStatusFormBusy] = useState(false);

  useEffect(() => {
    document.title = `FixTheCity — مركز القيادة: ${incident.id}`;
  }, [incident.id]);

  const category = getCategory(incident.categoryId);
  const isCritical = isCriticalIncident(incident);
  const daysOpen = (new Date().getTime() - new Date(incident.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const dueHours = hoursLateOf(incident.dueAt);
  const dueLabelText = formatDueLabel(dueHours);

  // Get the "why" explanations for priority factors
  const whyByKey: Record<string, string> = {
    severity: SEVERITY_AI_AR[incident.severity],
    sensitive: incident.sensitivePlace ? `قريب من ${incident.sensitivePlace}` : '',
    reporters: `${formatCitizens(incident.linkedReports.length)} بلّغوا`,
    age: `${Math.round(daysOpen)} أيام من أصل ${formatWorkDays(category.targetDays)}`,
    equity: incident.areaUnderserved ? 'منطقة محتاجة اهتمام' : '',
  };

  const reasonText = priorityReason(incident.priority, incident.linkedReports.length, incident.sensitivePlace);

  // Filter out dismissed duplicates from localStorage
  const getDismissedDuplicates = (): Set<string> => {
    const dismissed = new Set<string>();
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`ftc.dup.dismissed:${incident.id}:`)) {
          const parts = key.split(':');
          if (parts[3]) dismissed.add(parts[3]);
        }
      }
    }
    return dismissed;
  };

  const dismissed = getDismissedDuplicates();
  const matchedDuplicate = similarIncidents.find((match) => !dismissed.has(match.incidentId));

  // Status change options based on current status
  const getStatusOptions = () => {
    const allOptions = [
      { value: 'received', label: STATUS_LABEL_AR.received },
      { value: 'assigned', label: STATUS_LABEL_AR.assigned },
      { value: 'in_progress', label: STATUS_LABEL_AR.in_progress },
      { value: 'resolved', label: STATUS_LABEL_AR.resolved },
    ];

    // Only allow closed when current is resolved
    if (incident.status === 'resolved') {
      allOptions.push({ value: 'closed', label: STATUS_LABEL_AR.closed });
    }

    // Include current status if not in the list
    if (!allOptions.find((o) => o.value === incident.status)) {
      allOptions.unshift({ value: incident.status, label: STATUS_LABEL_AR[incident.status] });
    }

    return allOptions;
  };

  const getNextStatus = () => {
    switch (incident.status) {
      case 'received':
      case 'triaged':
        return 'assigned';
      case 'assigned':
        return 'in_progress';
      case 'in_progress':
        return 'resolved';
      case 'resolved':
        return 'closed';
      default:
        return incident.status;
    }
  };

  const handleStatusChange = async (data: { status: string; note: string }) => {
    try {
      setStatusFormBusy(true);
      await patchIncident(incident.id, {
        status: data.status,
        note: data.note,
      });

      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
      await queryClient.invalidateQueries({ queryKey: ['incidents'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    } finally {
      setStatusFormBusy(false);
    }
  };

  const handleMergeIncidents = async (targetId: string) => {
    await mergeIncidents(incident.id, targetId);

    // Invalidate queries and redirect
    await queryClient.invalidateQueries({ queryKey: ['incident'] });
    await queryClient.invalidateQueries({ queryKey: ['incidents'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });

    toast.success(`اتدمجت البلاغات في ${targetId}.`);
    router.push(`/incidents/${targetId}`);
  };

  const isClosed = incident.status === 'closed';

  return (
    <>
      {/* Breadcrumb and title row */}
      <nav className="crumbs" aria-label="مسار الصفحة">
        <Link href="/incidents">البلاغات</Link>
        <span aria-hidden>/</span>
        <span className="num">{incident.id}</span>
      </nav>

      {/* Chips row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {isCritical && <StatusChip kind="critical" />}
        <StatusChip kind="incident" status={incident.status} />
        <StatusChip kind="priority" score={incident.priority.score} />
      </div>

      <h1>{incident.title}</h1>

      {/* Metadata row */}
      <div className="meta">
        <span>
          <Icon name="pin" size={18} />
          {incident.location.address}
          {incident.location.landmark && ` · ${incident.location.landmark}`}
        </span>
        <span>
          <Icon name="clock" size={18} />
          {incident.status === 'resolved' || incident.status === 'closed'
            ? `اتصلّح ${formatWhen(incident.updatedAt)}`
            : `مفتوح من ${formatWhen(incident.createdAt)} · الميعاد ${formatWhen(incident.dueAt)} (${dueLabelText})`}
        </span>
        <span>
          <Icon name="users" size={18} />
          {formatCitizens(incident.linkedReports.length)} بلّغوا
        </span>
        <span className="num">{incident.id}</span>
      </div>

      {/* Main layout grid */}
      <div className="layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: '24px', maxWidth: '100%' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Photos card */}
          <PhotosCard incident={incident} />

          {/* Two-column section for AI and Details */}
          <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* AI Suggestion Card */}
            {incident.triage && (
              <AiSuggestionCard
                triage={incident.triage}
                reviewedBy={incident.lastReviewedBy}
                reviewedAt={incident.lastReviewedAt}
                canAct={canAct}
                incidentId={incident.id}
                onTriageConfirmed={() => {
                  queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
                  queryClient.invalidateQueries({ queryKey: ['incidents'] });
                  toast.success('اتأكّد التصنيف.');
                }}
              />
            )}

            {/* Details card */}
            <Card labelledBy="h-det-title">
              <CardHead id="h-det-title" title="تفاصيل" />
              <KvList
                items={[
                  { label: 'النوع', value: category.labelAr },
                  {
                    label: 'الجهة',
                    value: incident.external
                      ? `${category.department} · جهة خارجية · ${incident.externalHotline}`
                      : `${category.department} (الحي)`,
                  },
                  { label: 'هدف الاستجابة', value: formatWorkDays(category.targetDays) },
                  { label: 'تكلفة تقديرية', value: formatEgp(incident.estimatedCostEgp), numeric: true },
                  { label: 'المعلم القريب', value: incident.sensitivePlace || '—' },
                  {
                    label: 'آخر مراجعة',
                    value: incident.lastReviewedBy
                      ? `${incident.lastReviewedBy} · ${formatWhen(incident.lastReviewedAt!)}`
                      : 'محدّش راجعه لسه',
                  },
                  ...(incident.inBudgetPlan
                    ? [
                        {
                          label: 'خطة الميزانية',
                          value: <DangerTag>داخل الخطة</DangerTag>,
                        },
                      ]
                    : []),
                ]}
              />
            </Card>
          </div>

          {/* Priority card */}
          <Card labelledBy="h-pr-title">
            <CardHead
              id="h-pr-title"
              title="سبب الأولوية"
              subtitle="الحساب ثابت وبيتعرض بالكامل. مفيش حاجة مخفية."
            />
            <PriorityBreakdown priority={incident.priority} variant="full" reason={reasonText} whyByKey={whyByKey} />
          </Card>

          {/* Linked reports card */}
          <LinkedReportsCard incident={incident} />

          {/* Timeline card */}
          <Card labelledBy="h-tl-title">
            <CardHead
              id="h-tl-title"
              title="السجل الكامل"
              subtitle="الرسائل اللي بتتكتب هنا بتظهر للمواطنين في التتبع."
            />
            <TimelineContent incident={incident} session={session} />
          </Card>
        </div>

        {/* Right column (aside) */}
        <aside aria-label="إجراءات" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status form card */}
          <Card labelledBy="h-st-title">
            <CardHead id="h-st-title" title="غيّر الحالة" action={<StatusChip kind="incident" status={incident.status} />} />
            {isClosed ? (
              <Notice tone="gold" icon="alert-triangle">
                البلاغ اتقفل. مفيش تغييرات تانية.
              </Notice>
            ) : (
              <StatusChangeForm
                kind="incident"
                currentStatus={incident.status}
                options={getStatusOptions()}
                defaultStatus={getNextStatus()}
                previewStatusFor={(v) => v as import('@/domain/types').IncidentStatus}
                citizensCount={incident.linkedReports.length}
                disabledReason={!canAct ? 'ده بلاغ جهة تانية. تقدر تشوفه بس.' : undefined}
                onSubmit={handleStatusChange}
              />
            )}
          </Card>

          {/* Work order card */}
          <WorkOrderCard
            incident={incident}
            workOrder={workOrder}
            departments={departments}
            teams={teams}
            canAct={canAct}
            disabledReason={!canAct ? 'ده بلاغ جهة تانية. تقدر تشوفه بس.' : undefined}
          />

          {/* Location card */}
          <LocationCard incident={incident} />

          {/* Duplicate card */}
          {matchedDuplicate && (
            <DuplicateCard
              current={incident}
              matches={[matchedDuplicate]}
              canAct={canAct}
              onMerge={(targetId) => handleMergeIncidents(targetId)}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function TimelineContent({ incident, session }: { incident: AdminIncident; session?: StaffSession }) {
  type TimelineItemState = 'done' | 'current' | 'pending' | 'plain';

  const timelineItems: Array<{
    id: string;
    title: React.ReactNode;
    who?: React.ReactNode;
    body?: React.ReactNode;
    state?: TimelineItemState;
    ai?: boolean;
  }> = incident.timeline.map((entry) => ({
    id: `${entry.status}-${entry.at}`,
    title: STATUS_LABEL_AR[entry.status],
    who: `${entry.actor} · ${formatWhen(entry.at)}`,
    body: entry.note,
    state: 'done' as TimelineItemState,
    ai: entry.actor === 'الذكاء الاصطناعي',
  }));

  // Add synthetic rows for pending status transitions
  if (incident.status === 'received' || incident.status === 'triaged') {
    if (!incident.workOrderId) {
      timelineItems.push({
        id: 'pending-wo',
        title: 'في انتظار أمر شغل',
        who: `${session?.name} · دلوقتي`,
        body: 'اختار الفريق وأنشئ أمر الشغل عشان المواطنين يشوفوا إن الشغل بدأ.',
        state: 'current' as TimelineItemState,
      });
    }
  }

  if (incident.status === 'assigned' || incident.status === 'in_progress') {
    // Last entry becomes current
    if (timelineItems.length > 0) {
      timelineItems[timelineItems.length - 1].state = 'current' as TimelineItemState;
    }

    // Add pending entries
    if (incident.status !== 'in_progress') {
      timelineItems.push({
        id: 'pending-progress',
        title: 'جاري التنفيذ',
        state: 'pending' as TimelineItemState,
      });
      timelineItems.push({
        id: 'pending-resolved',
        title: 'اتصلّح',
        state: 'pending' as TimelineItemState,
      });
    }
  }

  if (incident.status === 'in_progress') {
    timelineItems.push({
      id: 'pending-resolved',
      title: 'اتصلّح',
      state: 'pending' as TimelineItemState,
    });
  }

  return <Timeline items={timelineItems} />;
}
