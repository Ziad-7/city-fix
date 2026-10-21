'use client';
import type L from 'leaflet';

import { useMemo } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/domain/types';
import { pinSvg } from '../brand';
import { BaseMap, pinIcon } from './LeafletBase';

function ClickToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Report location: a draggable red pin; clicking the map moves it too. */
export default function LocationPickerMap({ point, onMove }: { point: LatLng; onMove: (p: LatLng) => void }) {
  const icon = useMemo(() => pinIcon(pinSvg('#C8102E')), []);
  return (
    <BaseMap center={point} zoom={16} label="خريطة: موقع البلاغ">
      <ClickToMove onMove={onMove} />
      <Marker
        position={[point.lat, point.lng]}
        icon={icon}
        draggable
        keyboard={false}
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng();
            onMove({ lat: ll.lat, lng: ll.lng });
          },
        }}
      />
    </BaseMap>
  );
}
