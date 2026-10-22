import type { IconName } from '@/domain/types';
import { Icon } from './Icon';

/** Loading, empty and error states (the app's StateMessage). */
export function StateMessage({
  title, body, icon, loading, tone, actionLabel, onAction, actionHref,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  loading?: boolean;
  tone?: 'error';
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className={`ftc-card a-state${tone === 'error' ? ' is-error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {loading ? <span className="a-spin" aria-hidden="true" /> : icon ? <span className="ftc-icon-well"><Icon name={icon} size={22} /></span> : null}
      <b>{title}</b>
      {body ? <p>{body}</p> : null}
      {actionLabel && actionHref ? (
        <a className="ftc-btn ftc-btn--secondary ftc-btn--sm" href={actionHref}>{actionLabel}</a>
      ) : actionLabel && onAction ? (
        <button className="ftc-btn ftc-btn--secondary ftc-btn--sm" type="button" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}
