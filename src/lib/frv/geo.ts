import { RADIUS_BANDS } from './constants';
import type { Tone } from './types';

const EARTH_RADIUS_MILES = 3958.7613;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in miles.
 *
 * Haversine rather than a planar approximation: claim geography spans the
 * continental US, and a flat-earth shortcut drifts enough at northern latitudes
 * to move a comp across the two-mile band boundary, which changes whether the
 * operator owes a written justification.
 */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type RadiusBand = 'clean' | 'acceptable' | 'needs-justification' | 'beyond-limit';

export function classifyDistance(miles: number): { band: RadiusBand; tone: Tone } {
  if (miles < RADIUS_BANDS.clean) return { band: 'clean', tone: 'pass' };
  if (miles <= RADIUS_BANDS.acceptable) return { band: 'acceptable', tone: 'pass' };
  if (miles <= RADIUS_BANDS.needsJustification)
    return { band: 'needs-justification', tone: 'warn' };
  return { band: 'beyond-limit', tone: 'block' };
}

/** One decimal and the unit, per the brand book: "2.5 miles". */
export function formatMiles(miles: number): string {
  return `${miles.toFixed(1)} miles`;
}
