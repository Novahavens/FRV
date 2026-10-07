import 'server-only';
import type { StoredClaim } from '@/lib/db/claims';
import {
  fetchImage,
  mapsKey,
  staticMapUrl,
  streetViewAvailable,
  streetViewUrl,
  type MapComp,
  type StreetViewLocation,
} from './google-static';

function lossLocation(claim: StoredClaim): StreetViewLocation {
  return { address: claim.loss.address, lat: claim.loss.lat, lng: claim.loss.lng };
}

function mapPins(claim: StoredClaim) {
  const comps: MapComp[] = claim.calculation.comps.map((c) => ({
    lat: c.lat,
    lng: c.lng,
    position: c.sortPosition + 1,
  }));
  comps.sort((a, b) => a.position - b.position);
  return { loss: { lat: claim.loss.lat, lng: claim.loss.lng }, comps };
}

/** URLs for the web report: our own routes, never a Google URL. */
export async function reportImagery(
  claim: StoredClaim,
): Promise<{ photoUrl: string | null; mapUrl: string | null }> {
  const key = mapsKey();
  if (!key) return { photoUrl: claim.photoUrl, mapUrl: null };
  const photoUrl =
    claim.photoUrl ??
    ((await streetViewAvailable(key, lossLocation(claim)))
      ? `/api/claims/${claim.id}/street-view`
      : null);
  return { photoUrl, mapUrl: `/api/claims/${claim.id}/map` };
}

/** Image bytes for the PDF, fetched directly from Google. */
export async function reportImages(
  claim: StoredClaim,
): Promise<{ photo?: Buffer; map?: Buffer }> {
  const key = mapsKey();
  if (!key) return {};
  const loc = lossLocation(claim);

  const photoTask = (async () => {
    if (!(await streetViewAvailable(key, loc))) return null;
    return fetchImage(streetViewUrl(key, loc));
  })();
  const mapTask = fetchImage(staticMapUrl(key, mapPins(claim)));

  const [photo, map] = await Promise.all([photoTask, mapTask]);
  return { ...(photo ? { photo: photo.data } : {}), ...(map ? { map: map.data } : {}) };
}

export { mapPins, lossLocation };
