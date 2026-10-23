'use client';

import { binStateLabel, type BinState } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { localDigits } from '@/utils/digits';
import { FULL_PCT } from '@/lib/smart-bin';
import { Icon } from '../Icon';
import { BIN_COLOR, BIN_ICON } from './BinParts';

const BODY = 'M30 70 H170 L158 245 Q157 252 150 252 H50 Q43 252 42 245 Z';
const FILL_H = 182;

type Props = { fillPct: number; state: BinState; size?: number; decorative?: boolean };

/** Picture of a smart bin: the fill follows the level, the colour follows the state, the lid lifts when it is full. */
export function SmartBinFigure({ fillPct, state, size = 260, decorative }: Props) {
  const tr = useTr();
  const pct = Math.round(Math.min(100, Math.max(0, fillPct)));
  const h = (FILL_H * pct) / 100;
  const full = state === 'full';
  const color = BIN_COLOR[state];
  const label = tr(`صندوق ذكي، مليان ${localDigits(pct)}٪، ${binStateLabel(state)}`, `Smart bin, ${pct}% full, ${binStateLabel(state)}`);
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': label };
  const markY = 252 - (FILL_H * FULL_PCT) / 100;
  const clipId = `sbf-clip-${size}`;
  return (
    <div className="cc-sbf" style={{ width: size, height: (size * 260) / 200 }}>
      <svg viewBox="0 0 200 260" width="100%" height="100%" {...a11y}>
        <defs>
          <clipPath id={clipId}><path d={BODY} /></clipPath>
        </defs>
        <g opacity={state === 'offline' ? 0.55 : 1}>
          <path d={BODY} fill="var(--ftc-surface)" />
          <g clipPath={`url(#${clipId})`}>
            <rect x="20" y={252 - h} width="160" height={h} fill={color} opacity="0.85" />
          </g>
          <path d={BODY} fill="none" stroke="var(--ftc-ink)" strokeWidth="4" strokeLinejoin="round" />
          <line x1="36" x2="164" y1={markY} y2={markY} stroke="var(--ftc-ink)" strokeWidth="1.5" strokeDasharray="5 4" />
          <text x="100" y={markY - 4} textAnchor="middle" fontSize="11" fill="var(--ftc-ink)" fontWeight="600">{localDigits(FULL_PCT)}{tr('٪', '%')}</text>
          {full ? (
            <g stroke="var(--ftc-ink)" strokeWidth="3" fill="var(--ftc-surface)" strokeLinejoin="round">
              <rect x="60" y="34" width="22" height="34" rx="6" transform="rotate(-12 71 51)" />
              <rect x="92" y="40" width="34" height="28" rx="3" transform="rotate(8 109 54)" />
              <rect x="124" y="32" width="18" height="36" rx="5" transform="rotate(14 133 50)" />
            </g>
          ) : null}
          <g className="cc-sb-lid" style={{ transformOrigin: '20px 70px', transform: full ? 'rotate(-22deg)' : 'none' }}>
            <rect x="20" y="52" width="160" height="18" rx="6" fill="var(--ftc-surface)" stroke="var(--ftc-ink)" strokeWidth="4" />
            <rect x="86" y="42" width="28" height="10" rx="4" fill="var(--ftc-ink)" />
          </g>
        </g>
        {state === 'hot' ? (
          <g fill="none" stroke="var(--ftc-urgent-deep)" strokeWidth="4" strokeLinecap="round">
            <path d="M70 34 q-8 -8 0 -16 q8 -8 0 -16" />
            <path d="M100 34 q-8 -8 0 -16 q8 -8 0 -16" />
            <path d="M130 34 q-8 -8 0 -16 q8 -8 0 -16" />
          </g>
        ) : null}
      </svg>
      <span className="cc-sbf-badge" style={{ background: color, width: Math.round(size * 0.17), height: Math.round(size * 0.17) }} aria-hidden="true">
        <Icon name={BIN_ICON[state]} size={Math.max(14, Math.round(size * 0.09))} />
        {state === 'offline' ? <span className="cc-sbf-slash" /> : null}
      </span>
    </div>
  );
}
