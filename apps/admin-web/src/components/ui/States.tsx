import type { IncidentStatus } from '@/domain/types';
import { Icon } from '../Icon';
import type { AdminIconName } from '../admin-icon-shapes';
import { StatusChip } from './StatusChip';
import { Timeline } from './Timeline';
import { Button } from './Button';

export interface NoticeProps {
  tone?: 'gold' | 'danger' | 'ai';
  icon?: AdminIconName;
  children: React.ReactNode;
  className?: string;
}

export function Notice({ tone, icon, children, className = '' }: NoticeProps) {
  const classes = [
    'ftc-notice',
    tone === 'danger' && 'ftc-notice--danger',
    tone === 'ai' && 'ftc-notice--ai',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </div>
  );
}

export interface CitizenPreviewProps {
  status: IncidentStatus;
  note: string;
}

export function CitizenPreview({ status, note }: CitizenPreviewProps) {
  return (
    <div className="cit-preview" aria-live="polite">
      <span className="ttl">هيظهر للمواطن كده</span>
      <Timeline
        items={[
          {
            id: 'preview',
            state: 'current',
            title: <StatusChip kind="incident" status={status} />,
            who: <span className="num">دلوقتي</span>,
            body: note.trim() || 'اكتب الرسالة وهتظهر هنا',
          },
        ]}
      />
    </div>
  );
}

export interface EmptyStateProps {
  icon?: AdminIconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = 'info', title, message, action }: EmptyStateProps) {
  return (
    <div className="ftc-state">
      <span className="ftc-icon-well">
        <Icon name={icon} size={20} />
      </span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  variant?: 'error' | 'forbidden' | 'notfound';
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}

export function ErrorState({
  variant = 'error',
  title,
  message,
  onRetry,
  action,
}: ErrorStateProps) {
  const defaults = {
    error: {
      icon: 'alert-triangle' as const,
      wellClass: 'ftc-icon-well--danger',
      title: 'حصلت مشكلة وإحنا بنحمّل البيانات',
      message: 'اتأكد من النت وجرّب تاني.',
    },
    forbidden: {
      icon: 'shield-check' as const,
      wellClass: '',
      title: 'مش مسموح',
      message: 'الصفحة دي مش متاحة لحسابك.',
    },
    notfound: {
      icon: 'search' as const,
      wellClass: '',
      title: 'مش موجود',
      message: 'ممكن يكون اتمسح أو الرقم غلط.',
    },
  };

  const config = defaults[variant];

  return (
    <div className="ftc-state">
      <span className={`ftc-icon-well ${config.wellClass}`}>
        <Icon name={config.icon} size={20} />
      </span>
      <h2>{title || config.title}</h2>
      {(message || config.message) && <p>{message || config.message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          جرّب تاني
        </Button>
      )}
      {action}
    </div>
  );
}

export interface SkeletonProps {
  variant: 'line' | 'title' | 'metric' | 'block' | 'table';
  rows?: number;
  width?: string | number;
  height?: number;
}

export function Skeleton({ variant, width, height, rows = 6 }: SkeletonProps) {
  if (variant === 'table') return <div aria-hidden>{Array.from({ length: rows }, (_, index) => <Skeleton key={index} variant="line" />)}</div>;
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = `${height}px`;

  return <span className={`ftc-skel ftc-skel--${variant}`} aria-hidden style={style} />;
}

export interface SkeletonTableProps {
  rows?: number;
  cols: number;
}

export function SkeletonTable({ rows = 6, cols }: SkeletonTableProps) {
  return (
    <>
      {Array(rows)
        .fill(null)
        .map((_, i) => (
          <tr key={i}>
            {Array(cols)
              .fill(null)
              .map((_, j) => (
                <td key={j}>
                  <Skeleton variant="line" />
                </td>
              ))}
          </tr>
        ))}
    </>
  );
}
