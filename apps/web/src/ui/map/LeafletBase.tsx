'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import type { LatLng } from '@/domain/types';

export const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Re-centres when `center` changes (GPS fix, new area). */
function Recenter({ center, zoom }: { center: LatLng; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

/** Plain "Leaflet" credit (no flag), next to the OpenStreetMap attribution the tiles require. */
function AttributionPrefix() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  }, [map]);
  return null;
}

/** Exposes the Leaflet map to a parent (zoom buttons, fly-to on selection). */
function Expose({ onReady }: { onReady?: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);
  return null;
}

export function BaseMap({
  center, zoom = 15, children, onReady, label, recenter = true,
}: { center: LatLng; zoom?: number; children?: React.ReactNode; onReady?: (m: L.Map) => void; label: string; recenter?: boolean }) {
  return (
    <div className="a-map" role="region" aria-label={label}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} zoomControl={false} scrollWheelZoom attributionControl>
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
        {recenter ? <Recenter center={center} /> : null}
        <AttributionPrefix />
        <Expose onReady={onReady} />
        {children}
      </MapContainer>
    </div>
  );
}

export const pinIcon = (svg: string, selected = false) =>
  L.divIcon({ className: `a-pin${selected ? ' is-sel' : ''}`, html: svg, iconSize: [34, 38], iconAnchor: [17, 37] });

export const meIcon = () => L.divIcon({ className: 'a-pin a-pin--me', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
