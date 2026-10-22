'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { CATEGORIES } from '@/domain/categories';
import type { CategoryId } from '@/domain/types';
import { labelOfCategory, useTr } from '@/i18n';
import { EmergencyBox } from './Hotlines';
import { Icon } from './Icon';
import { DangerTag } from './StatusChip';

/** The 12 categories as tiles. Links to the form, or buttons when `onSelect` is given (picker). */
export function CategoryGrid({ selected, onSelect }: { selected?: CategoryId | null; onSelect?: (id: CategoryId) => void }) {
  useTr();
  return (
    <div className="c-grid">
      {CATEGORIES.map((c) => {
        const inner = (
          <>
            {c.danger ? <DangerTag /> : null}
            <span className={`ftc-icon-well${c.danger ? ' ftc-icon-well--danger' : ''}`}><Icon name={c.icon} size={24} /></span>
            <b>{labelOfCategory(c)}</b>
          </>
        );
        return onSelect ? (
          <button
            key={c.id}
            type="button"
            className={`ftc-tile c-tile${selected === c.id ? ' is-sel' : ''}`}
            aria-pressed={selected === c.id}
            data-testid={`pick-${c.id}`}
            onClick={() => onSelect(c.id)}
          >
            {inner}
          </button>
        ) : (
          <Link key={c.id} className="ftc-tile c-tile" href={`/report/new?category=${c.id}`} data-testid={`category-${c.id}`}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

/** "اختار نوع المشكلة" dialog (the app's bottom sheet), with the emergency box on top. */
export function CategoryPicker({ open, selected, onClose, onSelect }: { open: boolean; selected: CategoryId | null; onClose: () => void; onSelect: (id: CategoryId) => void }) {
  const tr = useTr();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="a-dialog"
      aria-labelledby="picker-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="a-dialog__head">
        <h2 id="picker-title">{tr('اختار نوع المشكلة', 'Choose the problem type')}</h2>
        <button type="button" className="a-x" aria-label={tr('إغلاق', 'Close')} onClick={onClose}><Icon name="x" size={20} /></button>
      </div>
      <div className="a-dialog__body">
        <EmergencyBox />
        <CategoryGrid selected={selected} onSelect={onSelect} />
      </div>
    </dialog>
  );
}
