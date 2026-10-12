/**
 * Loads the Google Maps JS API once per page and resolves with the Places library.
 *
 * Readiness comes from the API's own `callback` parameter, not the script's
 * load event: with `loading=async` the load event fires before
 * `google.maps.importLibrary` exists, so calling it there throws and the
 * suggestions never start.
 */

type PlacesLib = google.maps.PlacesLibrary;

/** Global the Maps API calls once it is ready. */
export const MAPS_READY_CALLBACK = '__frvMapsReady';

let pending: Promise<PlacesLib> | null = null;

export function loadPlaces(apiKey: string): Promise<PlacesLib> {
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function') return resolve();
    const globals = window as unknown as Record<string, unknown>;
    globals[MAPS_READY_CALLBACK] = () => {
      delete globals[MAPS_READY_CALLBACK];
      resolve();
    };
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&libraries=places&loading=async&callback=${MAPS_READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      delete globals[MAPS_READY_CALLBACK];
      script.remove();
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  })
    .then(() => google.maps.importLibrary('places') as Promise<PlacesLib>)
    .catch((err: unknown) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** Forgets the cached load. Tests only. */
export function resetPlacesLoader(): void {
  pending = null;
}
