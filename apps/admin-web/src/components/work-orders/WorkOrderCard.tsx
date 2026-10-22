'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Tag } from '@/components/ui';
import type { WorkOrder } from '@/domain/admin-types';
import { formatDayDM, formatDayWithTime, formatDueLabel, shortAddress } from '@/lib/format';

export interface WorkOrderCardProps {
  wo: WorkOrder;
  selected?: boolean;
  now: number;
  onOpen: (id: string) => void;
}

function teamLine(wo: WorkOrder): string {
  if (wo.external) {
    return `بلّغنا الشركة · الخط الساخن ${wo.externalHotline}`;
  }
  if (wo.team) {
    return `${wo.team}${wo.teamSize ? ` · ${wo.teamSize} أفراد` : ''}`;
  }
  return 'لسه من غير فريق';
}

function dueLine(wo: WorkOrder, now: number): string {
  if (wo.status === 'done') {
    return `اتحلّت ${formatDayWithTime(wo.resolvedAt!, now)}`;
  }
  return `التسليم ${formatDayDM(wo.dueAt, now)}`;
}

function handleKeyDown(e: React.KeyboardEvent, onOpen: (id: string) => void, woId: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onOpen(woId);
  }
}

function handleLinkClick(e: React.MouseEvent) {
  e.stopPropagation();
}

export function WorkOrderCard({ wo, selected, now, onOpen }: WorkOrderCardProps) {
  const late = wo.overdue && wo.status !== 'done';
  const hoursLate = late ? Math.round((now - new Date(wo.dueAt).getTime()) / (1000 * 60 * 60)) : 0;

  const classes = ['wo'];
  if (late) classes.push('is-late');
  if (selected) classes.push('is-open');

  const dueClasses = ['due'];
  if (late) dueClasses.push('late');

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes.join(' ')}
      onClick={() => onOpen(wo.id)}
      onKeyDown={(e) => handleKeyDown(e, onOpen, wo.id)}
      aria-label={`أمر الشغل ${wo.id}: ${wo.title}`}
    >
      <div className="top">
        <span className="id">{wo.id}</span>
        {late ? (
          <Tag tone="danger">{formatDueLabel(hoursLate)}</Tag>
        ) : wo.external ? (
          <Tag tone="ext">جهة خارجية</Tag>
        ) : null}
      </div>
      <span className="t">{wo.title}</span>
      <span className="row">
        <Icon name={wo.incidentId ? 'alert-triangle' : 'truck'} size={14} />
        <Link
          className="inc"
          href={wo.incidentId ? `/incidents/${wo.incidentId}` : `/service-requests/${wo.serviceRequestId}`}
          onClick={handleLinkClick}
        >
          {wo.incidentId ?? wo.serviceRequestId}
        </Link>
      </span>
      <span className="row">
        <Icon name="list" size={14} />
        {wo.department}
      </span>
      <span className="row">
        <Icon name="users" size={14} />
        {teamLine(wo)}
      </span>
      <span className="row">
        <Icon name={wo.status === 'done' ? 'check' : 'calendar'} size={14} />
        <span className={dueClasses.join(' ')}>{dueLine(wo, now)}</span>
      </span>
    </div>
  );
}
