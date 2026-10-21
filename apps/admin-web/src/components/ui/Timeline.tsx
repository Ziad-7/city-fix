import { Icon } from '../Icon';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  who?: React.ReactNode;
  body?: React.ReactNode;
  state?: 'done' | 'current' | 'pending' | 'plain';
  ai?: boolean;
}

export interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="ftc-timeline">
      {items.map((i) => (
        <li key={i.id} className={i.state && i.state !== 'plain' ? `is-${i.state}` : undefined}>
          <div className="tl-item">
            <b>{i.title}</b>
            {i.ai && (
              <span className="ai-tag">
                <Icon name="sparkles" size={12} />
                اقتراح
              </span>
            )}
            {i.who && <div className="who">{i.who}</div>}
            {i.body && <div className="small">{i.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
