'use client';

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { IconName } from '@/domain/types';
import { getLang } from '@/i18n';
import { Icon } from './Icon';

/** On/off switch (`.ftc-toggle`), a real button with role="switch". */
export function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return (
    <button
      type="button"
      className={`ftc-toggle${on ? ' is-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      onClick={() => onChange(!on)}
    />
  );
}

/** Icon well + title/subtitle + switch (`.w-trow`). */
export function ToggleRow({
  icon, title, subtitle, on, onChange, testId, bare,
}: { icon: IconName; title: string; subtitle?: ReactNode; on: boolean; onChange: (v: boolean) => void; testId?: string; bare?: boolean }) {
  return (
    <div className={`w-trow${bare ? ' card-trow' : ''}`}>
      <span className="ftc-icon-well"><Icon name={icon} size={20} /></span>
      <span className="w-grow">
        <span className="w-t">{title}</span>
        {subtitle ? <span className="w-m">{subtitle}</span> : null}
      </span>
      <Toggle on={on} onChange={onChange} label={title} testId={testId} />
    </div>
  );
}

/**
 * Keyboard for one radio of a radiogroup whose radios are the direct children of the group element: Space/Enter
 * choose it; the arrows (RTL: left/down = next, right/up = previous) choose the neighbour AND move focus to it, so
 * the next arrow continues from there (roving tabindex). In LTR (English) the arrows swap: right/down = next. Returns true when it handled the key.
 */
export function radioKeys(e: KeyboardEvent<HTMLElement>, index: number, count: number, choose: (i: number) => void): boolean {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    choose(index);
    return true;
  }
  const [nextKey, prevKey] = getLang() === 'en' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
  const step = e.key === nextKey || e.key === 'ArrowDown' ? 1 : e.key === prevKey || e.key === 'ArrowUp' ? -1 : 0;
  if (!step) return false;
  e.preventDefault();
  const next = (index + step + count) % count;
  choose(next);
  (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  return true;
}

/** Single-choice group of `.w-choice` radios (keyboard: Space/Enter, arrows move between options and focus). */
export function ChoiceGroup<T extends string>({
  options, value, onChange, label, labelledBy, className, style, testIdPrefix, marker = true,
}: {
  options: { id: T; label: ReactNode; ariaLabel?: string; className?: string; style?: CSSProperties }[];
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
  style?: CSSProperties;
  testIdPrefix?: string;
  /** The round marker before the label (off for the day tiles). */
  marker?: boolean;
}) {
  return (
    <div className={className} style={style} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <div
            key={o.id}
            className={`w-choice${on ? ' is-on' : ''}${o.className ? ` ${o.className}` : ''}`}
            style={o.style}
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            data-testid={testIdPrefix ? `${testIdPrefix}-${o.id}` : undefined}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => radioKeys(e, i, options.length, (n) => onChange(options[n].id))}
          >
            {marker ? <span className="mk" /> : null}
            {o.label}
          </div>
        );
      })}
    </div>
  );
}

/** Multi-select tick boxes (`.w-choice.chk`), e.g. bulky-waste items. */
export function CheckGroup({
  options, value, onChange, label, className,
}: { options: string[]; value: string[]; onChange: (v: string[]) => void; label?: string; className?: string }) {
  return (
    <div className={className} role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        const toggle = () => onChange(on ? value.filter((x) => x !== o) : [...value, o]);
        return (
          <div
            key={o}
            className={`w-choice chk${on ? ' is-on' : ''}`}
            role="checkbox"
            aria-checked={on}
            tabIndex={0}
            onClick={toggle}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggle();
              }
            }}
          >
            <span className="mk"><Icon name="check" size={14} strokeWidth={2.5} /></span>
            {o}
          </div>
        );
      })}
    </div>
  );
}

/** Filter pills (`.ftc-filter`, aria-pressed). */
export function Pills<T extends string>({
  options, value, onChange, label, labelledBy,
}: { options: { id: T; labelAr: string }[]; value: T; onChange: (v: T) => void; label?: string; labelledBy?: string }) {
  return (
    <div className="w-pills" role="group" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`ftc-filter${o.id === value ? ' is-active' : ''}`}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.labelAr}
        </button>
      ))}
    </div>
  );
}

/** Labelled native select with the chevron (`.w-sel`). */
export function SelectField({
  id, label, value, options, onChange,
}: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="ftc-field">
      <label className="ftc-label" htmlFor={id}>{label}</label>
      <div className="w-sel">
        <select className="ftc-select" id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icon name="chevron-down" size={18} />
      </div>
    </div>
  );
}
