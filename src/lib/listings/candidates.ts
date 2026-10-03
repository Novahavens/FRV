import { RADIUS_BANDS, SQFT_TOLERANCE, classifyDistance, distanceMiles } from '@/lib/frv';
import type { RadiusBand } from '@/lib/frv';
import type { ZillowRentalRecord } from './zillow-record';

/**
 * Turn a page of Zillow rental search results into a shortlist an account
 * manager can pick comps from.
 *
 * Pure: no I/O, no framework. The search itself is a provider concern; what
 * qualifies as a candidate is a methodology concern and lives here so it can be
 * tested against captured payloads and read in one place.
 *
 * The shortlist is a suggestion. Selection stays human — the operator clicks a
 * candidate, which runs the same single-listing lookup a pasted URL would, so
 * Rule 1 (furnished) still runs on the full listing text before anything is
 * accepted. Nothing here is ever written to a claim directly.
 */

/** One rental_search record. The fields a shortlist needs, read defensively. */
export interface ZillowSearchRecord extends ZillowRentalRecord {
  url?: string | null;
  zpid?: string | number | null;
  is_building?: boolean | null;
  home_type?: string | null;
}

export interface CompCandidate {
  url: string;
  zpid: string;
  address: string;
  rentCents: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lat: number;
  lng: number;
  homeType: string | null;
  distanceMiles: number;
  band: Exclude<RadiusBand, 'beyond-limit'>;
  attribution: string | null;
}

export interface CandidateCriteria {
  /** Bedrooms may differ from the loss by this much. Default 1. */
  bedroomVariance: number;
  /** Bathrooms may differ from the loss by this much. Default 1. */
  bathroomVariance: number;
  /** Square footage tolerance as a fraction. Default SQFT_TOLERANCE (15%). */
  sqftTolerance: number;
  /** Search inside this radius first. Default RADIUS_BANDS.acceptable (2 mi). */
  preferredRadiusMiles: number;
  /** Widen to RADIUS_BANDS.needsJustification only when fewer than this remain. Default 6. */
  minimumBeforeWidening: number;
}

export const DEFAULT_CRITERIA: CandidateCriteria = {
  bedroomVariance: 1,
  bathroomVariance: 1,
  sqftTolerance: SQFT_TOLERANCE,
  preferredRadiusMiles: RADIUS_BANDS.acceptable,
  minimumBeforeWidening: 6,
};

export interface LossShape {
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
}

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * Filter and rank search records against the loss property.
 *
 * Order of operations mirrors the rules an operator would apply by hand:
 * drop what cannot be a comp (apartment communities, delisted, incomplete),
 * keep what is like-for-like (bedrooms, bathrooms, size), then geography — the
 * two-mile band first, widening to five only when the near set is thin. Past
 * five miles nothing is offered, because the engine would block it anyway.
 *
 * Within a band, closest first. Rent is deliberately not a ranking input:
 * putting the highest rent at the top would steer selection, and the
 * methodology sorts high to low *after* the human has chosen.
 */
export function rankCandidates(
  loss: LossShape,
  records: readonly ZillowSearchRecord[],
  criteria: Partial<CandidateCriteria> = {},
): CompCandidate[] {
  const c = { ...DEFAULT_CRITERIA, ...criteria };
  const seen = new Set<string>();
  const qualified: CompCandidate[] = [];

  for (const r of records) {
    // Rental search returns apartment communities as one card with a rent range.
    // A community is not a comparable for a single home; its units would be
    // reached through `building`, which is out of scope.
    if (r.is_building) continue;
    if (r.status && r.status !== 'FOR_RENT') continue;

    const url = typeof r.url === 'string' && /zillow\.com\/homedetails\//i.test(r.url) ? r.url : null;
    const rent = finite(r.rent);
    const beds = finite(r.beds);
    const baths = finite(r.baths);
    const sqft = finite(r.sqft);
    const lat = finite(r.lat);
    const lng = finite(r.lon);
    const address = r.address?.text?.trim() || r.address?.line1?.trim() || null;
    if (!url || rent == null || beds == null || baths == null || sqft == null || lat == null || lng == null || !address) continue;

    const zpid = r.zpid != null ? String(r.zpid) : url;
    if (seen.has(zpid)) continue;

    if (Math.abs(beds - loss.bedrooms) > c.bedroomVariance) continue;
    if (Math.abs(baths - loss.bathrooms) > c.bathroomVariance) continue;
    if (Math.abs(sqft - loss.sqft) / loss.sqft > c.sqftTolerance) continue;

    const miles = distanceMiles(loss, { lat, lng });
    const { band } = classifyDistance(miles);
    if (band === 'beyond-limit') continue;

    seen.add(zpid);
    qualified.push({
      url,
      zpid,
      address,
      rentCents: Math.round(rent * 100),
      bedrooms: beds,
      bathrooms: baths,
      sqft,
      lat,
      lng,
      homeType: r.home_type ?? null,
      distanceMiles: miles,
      band,
      attribution: r.attribution ?? null,
    });
  }

  qualified.sort((a, b) => a.distanceMiles - b.distanceMiles);

  const near = qualified.filter((q) => q.distanceMiles <= c.preferredRadiusMiles);
  if (near.length >= c.minimumBeforeWidening) return near;
  return qualified;
}

/**
 * The location text rental_search needs, from a free-text loss address.
 *
 * A ZIP is the tightest region Zillow resolves without a map box, so it is
 * preferred. Failing that, the trailing "City, ST" is used. The radius filter
 * above does the real geographic work either way.
 */
export function searchLocationFor(address: string): string | null {
  const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(address);
  if (zip?.[1]) return zip[1];

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const tail = parts.slice(-2).join(', ').replace(/\s+\d{5}(-\d{4})?$/, '').trim();
    return tail || null;
  }
  return null;
}
