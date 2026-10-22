'use client';

import L from 'leaflet';
import { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Marker } from 'react-leaflet';
import { binDisplayName, binStateLabel, type Bin } from '@/domain/citycycle';
import type { LatLng } from '@/domain/types';
import { useTr } from '@/i18n';
import { BIN_COLOR, BIN_ICON } from '../citycycle';
import { Icon } from '../Icon';
import { BaseMap, meIcon } from './LeafletBase';

/** Round badge: state icon on white with a state-coloured ring, so the state reads by shape, not colour alone. */
const binIcon = (b: Bin, selected: boolean) =>
  L.divIcon({
    className: `a-pin cc-binpin${selected ? ' is-sel' : ''}`,
    html: `<span class="cc-binpin__b" style="--cc-bin:${BIN_COLOR[b.state]}">${renderToStaticMarkup(<Icon name={BIN_ICON[b.state]} size={20} strokeWidth={2.25} />)}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

/** Smart-bin map: one badge per bin (icon by state), the selected one enlarged, plus the area centre. */
export default function BinMap({
  bins, selectedId, onSelect, center, onReady,
}: { bins: Bin[]; selectedId: string | null; onSelect: (id: string) => void; center: LatLng; onReady?: (m: L.Map) => void }) {
  const tr = useTr();
  const icons = useMemo(() => new Map(bins.map((b) => [b.id, { off: binIcon(b, false), on: binIcon(b, true) }])), [bins]);
  const me = useMemo(() => meIcon(), []);
  return (
    <BaseMap center={center} zoom={15} label={tr('خريطة الصناديق الذكية', 'Smart bins map')} onReady={onReady} recenter={false}>
      <Marker position={[center.lat, center.lng]} icon={me} interactive={false} keyboard={false} />
      {bins.map((b) => {
        const icon = icons.get(b.id);
        if (!icon) return null;
        const label = `${binDisplayName(b)}, ${binStateLabel(b.state)}`;
        return (
          <Marker
            key={b.id}
            position={[b.location.lat, b.location.lng]}
            icon={b.id === selectedId ? icon.on : icon.off}
            zIndexOffset={b.id === selectedId ? 1000 : 0}
            title={label}
            alt={label}
            eventHandlers={{ click: () => onSelect(b.id) }}
          />
        );
      })}
    </BaseMap>
  );
}
