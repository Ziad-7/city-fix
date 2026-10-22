'use client';

import { Icon } from '../Icon';
import { MATERIALS, formatKg, formatPrice, materialLabel, priceOf, type MaterialId, type MaterialPrice, type PickupItem } from '@/domain/citycycle';
import { useLang } from '@/i18n';

/** Round icon badge for a material. */
export function MaterialBadge({ id, size = 40, on }: { id: MaterialId; size?: number; on?: boolean }) {
  return (
    <span className={`cc-badge${on ? ' is-on' : ''}`} style={{ width: size, height: size }}>
      <Icon name={MATERIALS[id].icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

type GridProps = {
  materials: readonly MaterialId[];
  selected: ReadonlySet<MaterialId>;
  prices: readonly MaterialPrice[];
  onToggle: (id: MaterialId) => void;
};

/** Two-column picker: icon, name, the district price (or "price to be set"), a check when chosen. */
export function MaterialGrid({ materials, selected, prices, onToggle }: GridProps) {
  useLang();
  return (
    <div className="cc-material-grid" role="list">
      {materials.map((id) => {
        const on = selected.has(id);
        const price = priceOf(prices, id);
        return (
          <button
            key={id}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={`${materialLabel(id)}, ${formatPrice(price)}`}
            onClick={() => onToggle(id)}
            className={`cc-material-cell${on ? ' is-on' : ''}`}
            data-testid={`material-${id}`}
          >
            <MaterialBadge id={id} on={on} />
            <span className="cc-material-text">
              <span className="cc-material-name">{materialLabel(id)}</span>
              <span className={`ftc-help${price === null ? ' cc-price-unset' : ''}`}>{formatPrice(price)}</span>
            </span>
            {on ? <Icon name="check" size={18} strokeWidth={3} className="cc-check" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only list: icon, name, estimated weight and the price per kg. */
export function MaterialLines({ items, prices }: { items: readonly PickupItem[]; prices?: readonly MaterialPrice[] }) {
  useLang();
  return (
    <div className="cc-material-lines">
      {items.map((it) => (
        <div key={it.materialId} className="cc-material-line">
          <MaterialBadge id={it.materialId} size={36} />
          <span className="cc-material-text">
            <span className="cc-material-name">{materialLabel(it.materialId)}</span>
            {prices ? <span className="ftc-help">{formatPrice(priceOf(prices, it.materialId))}</span> : null}
          </span>
          <span className="cc-material-name">{formatKg(it.estimatedKg)}</span>
        </div>
      ))}
    </div>
  );
}
