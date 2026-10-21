'use client';

import type { ReactNode } from 'react';
import type { IconName } from '@/domain/types';
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

/** Single-choice group of `.w-choice` radios (keyboard: Space/Enter, arrows move between options). */
export function ChoiceGroup<T extends string>({
  options, value, onChange, label, labelledBy, className, testIdPrefix,
}: {
  options: { id: T; label: ReactNode }[];
  value: T | null;
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
  testIdPrefix?: string;
}) {
  const move = (from: number, step: number) => {
    const next = options[(from + step + options.length) % options.length];
    onChange(next.id);
  };
  return (
    <div className={className} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <div
            key={o.id}
            className={`w-choice${on ? ' is-on' : ''}`}
            role="radio"
            aria-checked={on}
            tabIndex={on || (value === null && i === 0) ? 0 : -1}
            data-testid={testIdPrefix ? `${testIdPrefix}-${o.id}` : undefined}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onChange(o.id);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i, -1);
              }
            }}
          >
            <span className="mk" />
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
