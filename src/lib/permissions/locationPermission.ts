export interface LocationCoords {
  lat: number;
  lon: number;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'unsupported';

export function checkLocationSupport(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function requestCurrentPosition(
  onSuccess: (coords: LocationCoords) => void,
  onError: (status: LocationPermissionStatus, errorMsg?: string) => void
): () => void {
  if (!checkLocationSupport()) {
    onError('unsupported', 'Geolocation is not supported by your browser');
    return () => {};
  }

  let active = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (active) {
        onSuccess({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      }
    },
    (err) => {
      if (active) {
        onError('denied', err.message);
      }
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
  );

  return () => {
    active = false;
  };
}
