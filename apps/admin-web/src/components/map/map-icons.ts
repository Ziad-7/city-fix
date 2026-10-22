import L from 'leaflet';
import { pinSvg, type PinKind } from './map-utils';

export function pinIcon(kind: PinKind, selected = false, near = false): L.DivIcon {
  const lg = kind === 'critical' || selected;
  const [w, h] = lg ? [41, 48] : [30, 35];
  const classes = ['ftc-pin', lg && 'ftc-pin--lg', kind === 'critical' && 'ftc-pin--critical', selected && 'is-selected', near && 'ftc-pin--near'].filter(Boolean).join(' ');
  const tag = kind === 'critical' ? '<span class="ftc-pin__tag">خطر</span>' : '';
  return L.divIcon({ className: 'ftc-divicon', html: `<div class="${classes}">${tag}${pinSvg(kind)}</div>`, iconSize: [w, h], iconAnchor: [w / 2, h] });
}
