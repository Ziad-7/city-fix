'use client';

import type L from 'leaflet';
import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import type { LatLng, MapPin } from '@/domain/types';
import { pinSvg } from '../brand';
import { BaseMap, meIcon, pinIcon } from './LeafletBase';
import { pinColor } from './pinColor';

/** CityPulse map: status-coloured pins (red for critical), the selected one enlarged, plus the area centre. */
export default function IncidentMap({
  pins, selectedId, onSelect, center, onReady,
}: { pins: MapPin[]; selectedId: string | null; onSelect: (id: string) => void; center: LatLng; onReady?: (m: L.Map) => void }) {
  const icons = useMemo(() => new Map(pins.map((p) => [p.id, { off: pinIcon(pinSvg(pinColor(p))), on: pinIcon(pinSvg(pinColor(p)), true) }])), [pins]);
  const me = useMemo(() => meIcon(), []);
  return (
    <BaseMap center={center} zoom={15} label="خريطة البلاغات" onReady={onReady} recenter={false}>
      <Marker position={[center.lat, center.lng]} icon={me} interactive={false} keyboard={false} />
      {pins.map((p) => {
        const icon = icons.get(p.id);
        if (!icon) return null;
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={p.id === selectedId ? icon.on : icon.off}
            zIndexOffset={p.id === selectedId ? 1000 : p.critical ? 500 : 0}
            title={p.title}
            alt={p.title}
            eventHandlers={{ click: () => onSelect(p.id) }}
          />
        );
      })}
    </BaseMap>
  );
}
