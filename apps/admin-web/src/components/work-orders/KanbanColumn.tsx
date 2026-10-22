'use client';

import type { WorkOrderStatus } from '@/domain/admin-types';

export interface KanbanColumnProps {
  status: WorkOrderStatus;
  title: string;
  count: number;
  children: React.ReactNode;
}

const DOT_STATUS: Record<WorkOrderStatus, string> = {
  open: 'open',
  assigned: 'assigned',
  in_progress: 'progress',
  done: 'done',
};

export function KanbanColumn({ status, title, count, children }: KanbanColumnProps) {
  return (
    <section className="colm" aria-label={title}>
      <h2>
        <span className={`dot dot--${DOT_STATUS[status]}`} aria-hidden />
        {title}
        <span className="n">{count}</span>
      </h2>
      {count === 0 ? <p className="empty">مفيش أوامر شغل هنا</p> : children}
    </section>
  );
}
