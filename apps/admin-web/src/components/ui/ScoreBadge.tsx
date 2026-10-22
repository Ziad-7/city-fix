export interface ScoreBadgeProps {
  score: number;
  size?: 'md' | 'lg';
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  let tone: 'urgent' | 'high' | 'low';
  if (score >= 85) {
    tone = 'urgent';
  } else if (score >= 65) {
    tone = 'high';
  } else {
    tone = 'low';
  }

  const classes = ['score', `score--${tone}`, size === 'lg' && 'score--lg'].filter(Boolean).join(' ');

  return (
    <div className={classes} aria-label={`الأولوية ${score} من 100`}>
      <span>{score}</span>
    </div>
  );
}
