import dynamic from 'next/dynamic';

// Leaflet touches `window` on import: these only render in the browser.
export const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), { ssr: false });
export const IncidentMap = dynamic(() => import('./IncidentMap'), { ssr: false });
