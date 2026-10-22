'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Tooltip, AttributionControl, useMap, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { pinIcon, clusterIcon, type MapPinModel } from './map-utils';

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
  cluster = true,
  onMapReady,
}: Omit<MapViewProps, 'center' | 'zoom'>) {
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

  const markers = pins
    .filter((p) => p.id !== selectedId)
    .map((p) => (
      <Marker
        key={p.id}
        position={[p.lat, p.lng]}
        icon={pinIcon(p.kind, false, p.near)}
        title={`${p.id} · ${p.title}`}
        zIndexOffset={p.kind === 'critical' ? 1000 : 0}
        keyboard={interactive}
        eventHandlers={interactive ? { click: () => onSelect?.(p.id) } : {}}
      >
        <Tooltip direction="top" offset={[0, -34]} className="ftc-tip">
          {p.id} · {p.title}
        </Tooltip>
      </Marker>
    ));

  return (
    <>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <AttributionControl position="bottomleft" prefix={false} />

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

      {cluster ? (
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={48}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          disableClusteringAtZoom={17}
          iconCreateFunction={clusterIcon}
        >
          {markers}
        </MarkerClusterGroup>
      ) : (
        markers
      )}

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
  cluster = true,
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
        <MapContent pins={pins} selectedId={selectedId} onSelect={onSelect} circle={circle} interactive={interactive} cluster={cluster} onMapReady={onMapReady} />
      </MapContainer>
    </div>
  );
}
