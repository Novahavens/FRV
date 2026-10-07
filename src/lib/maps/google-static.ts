import 'server-only';

/**
 * Google Static imagery, fetched server-side only. The key comes from
 * GOOGLE_MAPS_SERVER_KEY and never leaves the server: URL builders take it as
 * an argument and their output is only ever passed to fetchImage(), never
 * returned to the browser.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface StreetViewLocation extends Partial<LatLng> {
  address?: string;
}

export interface MapComp extends LatLng {
  /** 1-based label shown on the pin (sortPosition + 1). */
  position: number;
}

export function mapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_SERVER_KEY);
}

export function mapsKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_KEY || null;
}

function streetViewParams(key: string, loc: StreetViewLocation): URLSearchParams {
  const address = loc.address?.trim();
  const location =
    address || (loc.lat !== undefined && loc.lng !== undefined ? `${loc.lat},${loc.lng}` : '');
  const params = new URLSearchParams();
  params.set('size', '640x400');
  params.set('location', location);
  params.set('source', 'outdoor');
  params.set('fov', '80');
  params.set('key', key);
  return params;
}

export function streetViewUrl(key: string, loc: StreetViewLocation): string {
  return `https://maps.googleapis.com/maps/api/streetview?${streetViewParams(key, loc)}`;
}

export function streetViewMetadataUrl(key: string, loc: StreetViewLocation): string {
  return `https://maps.googleapis.com/maps/api/streetview/metadata?${streetViewParams(key, loc)}`;
}

export function staticMapUrl(
  key: string,
  pins: { loss: LatLng; comps: MapComp[] },
): string {
  const params = new URLSearchParams();
  params.set('size', '480x360');
  params.set('scale', '2');
  params.set('maptype', 'hybrid');
  params.append('markers', `color:red|label:L|${pins.loss.lat},${pins.loss.lng}`);
  for (const c of pins.comps) {
    params.append('markers', `color:0x1D4ED8|label:${c.position}|${c.lat},${c.lng}`);
  }
  params.set('key', key);
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
}

export async function fetchImage(
  url: string,
  timeoutMs = 8000,
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType };
  } catch {
    return null;
  }
}

export async function streetViewAvailable(
  key: string,
  loc: StreetViewLocation,
): Promise<boolean> {
  try {
    const res = await fetch(streetViewMetadataUrl(key, loc), {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    return json.status === 'OK';
  } catch {
    return false;
  }
}
