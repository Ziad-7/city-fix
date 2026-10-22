export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  valueTone?: 'default' | 'urgent';
  note?: React.ReactNode;
  noteTone?: 'bad' | 'good' | 'mute';
  size?: 'lg' | 'md';
  footer?: React.ReactNode;
  loading?: boolean;
}

export function KpiCard({ label, value, valueTone, note, noteTone = 'mute', size = 'lg', footer, loading }: KpiCardProps) {
  const classes = ['ftc-card', 'kpi', size === 'md' && 'kpi--md'].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={classes}>
        <span className="l">{label}</span>
        <span className="ftc-skel ftc-skel--line" style={{ width: '55%' }} />
        <span className="ftc-skel ftc-skel--line" style={{ width: '40%' }} />
      </div>
    );
  }

  return (
    <div className={classes}>
      <span className="l">{label}</span>
      <span className={['ftc-metric', 'num', valueTone === 'urgent' && 'ftc-metric--urgent'].filter(Boolean).join(' ')}>
        {value}
      </span>
      {note && <span className={`d d--${noteTone}`}>{note}</span>}
      {footer}
    </div>
  );
}

/**
 * Delta component for rendering signed numbers with proper RTL support.
 * Renders <bdi dir="ltr">+14</bdi> so the sign stays left of digits.
 */
export function Delta({ value }: { value: number }) {
  const str = value === 0 ? '0' : value > 0 ? `+${value}` : `−${-value}`;
  return (
    <bdi dir="ltr">{str}</bdi>
  );
}
