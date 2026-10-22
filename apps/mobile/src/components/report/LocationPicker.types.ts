export type LocationPickerProps = {
  lat: number;
  lng: number;
  /** The citizen tapped the map or dropped the pin somewhere new. */
  onMove: (lat: number, lng: number) => void;
};
