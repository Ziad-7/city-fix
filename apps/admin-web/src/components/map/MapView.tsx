'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { pinIcon } from './map-icons';
import type { MapPinModel } from './map-utils';

export interface MapViewProps {
  pins: MapPinModel[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
  cluster?: boolean;
  circle?: { lat: number; lng: number; radiusM: number };
  onMapReady?: (map: L.Map) => void;
}

function MapContent({
  pins,
  selectedId,
  onSelect,
  circle,
  interactive,
  onMapReady,
}: Omit<MapViewProps, 'center' | 'zoom'> & { cluster?: boolean }) {
  const map = useMap();
  const selectedRef = useRef<MapPinModel | null>(null);

  const selected = pins.find(p => p.id === selectedId);

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (selected && selectedRef.current?.id !== selected.id) {
      selectedRef.current = selected;
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.4 });
    }
  }, [selected, map]);

  // Handle keyboard navigation
  useMapEvent('keydown', () => {
    if (!interactive) return;
    // Implementation for marker focus would go here
  });

  return (
    <>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {circle && (
        <Circle
          center={[circle.lat, circle.lng]}
          radius={circle.radiusM}
          pathOptions={{
            color: '#A50E25',
            weight: 1.5,
            dashArray: '5 5',
            fillColor: '#A50E25',
            fillOpacity: 0.08,
          }}
        />
      )}

      {pins.filter(p => p.id !== selectedId).map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.kind, false, p.near)}
          title={`${p.id} · ${p.title}`}
          zIndexOffset={p.kind === 'critical' ? 1000 : 0}
          eventHandlers={
            interactive
              ? {
                  click: () => onSelect?.(p.id),
                }
              : {}
          }
          keyboard={interactive}
        >
          <Popup className="ftc-tip">{p.id} · {p.title}</Popup>
        </Marker>
      ))}

      {selected && (
        <Marker position={[selected.lat, selected.lng]} icon={pinIcon(selected.kind, true)} zIndexOffset={2000} />
      )}
    </>
  );
}

export function MapView({
  pins,
  selectedId = null,
  onSelect,
  center = [30.056, 31.33],
  zoom = 15,
  interactive = true,
  circle,
  onMapReady,
}: MapViewProps) {
  return (
    <div dir="ltr" style={{ height: '100%' }}>
      <MapContainer
        center={center as [number, number]}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        keyboard={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <MapContent pins={pins} selectedId={selectedId} onSelect={onSelect} circle={circle} interactive={interactive} onMapReady={onMapReady} />
      </MapContainer>
    </div>
  );
}
