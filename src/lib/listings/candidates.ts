import { DEFAULT_SEARCH_RADIUS_MILES, RADIUS_BANDS, SQFT_TOLERANCE, classifyDistance, distanceMiles } from '@/lib/frv';
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
  pets?: string[] | null;
  available_from?: string | null;
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
  /** Pet kinds the listing allows, as Zillow reports them (lower-case). */
  pets: string[];
  /** ISO date the unit is available from, when Zillow reports one. */
  availableFrom: string | null;
  distanceMiles: number;
  band: Exclude<RadiusBand, 'beyond-limit'>;
  /**
   * How closely this listing matches the loss on beds, baths, size and home
   * type: 1 is identical, 0 is the edge of eligibility. The sort key.
   */
  likeness: number;
  /** 'exact' when beds and baths both match the loss and size is within 5%. */
  match: 'exact' | 'close';
  attribution: string | null;
}

export interface CandidateCriteria {
  /** Bedrooms may differ from the loss by this much. Default 1. */
  bedroomVariance: number;
  /** Bathrooms may differ from the loss by this much. Default 1. */
  bathroomVariance: number;
  /** Square footage tolerance as a fraction. Default SQFT_TOLERANCE (15%). */
  sqftTolerance: number;
  /** Offer nothing farther than this. Operator-chosen; default 2.5 mi, never past Rule 4's 5 mi. */
  radiusMiles: number;
}

export const DEFAULT_CRITERIA: CandidateCriteria = {
  bedroomVariance: 1,
  bathroomVariance: 1,
  sqftTolerance: SQFT_TOLERANCE,
  radiusMiles: DEFAULT_SEARCH_RADIUS_MILES,
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

/*
 * Likeness weights (sum 1.00). Eligibility gates run first; this only orders
 * what already qualified.
 *   bedrooms   0.35  exact; 0 when one off
 *   bathrooms  0.25  exact; 0.15 half a bath off; 0 a full bath off
 *   size       0.30  linear: 1 at identical sqft, 0 at the 15% tolerance edge
 *   home type  0.10  SINGLE_FAMILY (the report calls every comp a single family home)
 */
const W_BEDS = 0.35;
const W_BATHS_EXACT = 0.25;
const W_BATHS_HALF = 0.15;
const W_SQFT = 0.3;
const W_HOME_TYPE = 0.1;

export function scoreLikeness(
  loss: Pick<LossShape, 'bedrooms' | 'bathrooms' | 'sqft'>,
  candidate: { bedrooms: number; bathrooms: number; sqft: number; homeType: string | null },
  sqftTolerance: number = SQFT_TOLERANCE,
): number {
  let score = 0;
  if (candidate.bedrooms === loss.bedrooms) score += W_BEDS;
  const bathGap = Math.abs(candidate.bathrooms - loss.bathrooms);
  if (bathGap === 0) score += W_BATHS_EXACT;
  else if (bathGap <= 0.5) score += W_BATHS_HALF;
  const band = loss.sqft * sqftTolerance;
  const sizeFit = band > 0 ? 1 - Math.abs(candidate.sqft - loss.sqft) / band : 0;
  score += W_SQFT * Math.min(1, Math.max(0, sizeFit));
  if (candidate.homeType === 'SINGLE_FAMILY') score += W_HOME_TYPE;
  return Math.min(1, Math.max(0, score));
}

/**
 * Filter and rank search records against the loss property.
 *
 * Gates mirror the rules an operator would apply by hand: drop what cannot be
 * a comp (apartment communities, delisted, incomplete), keep what is
 * like-for-like (bedrooms, bathrooms, size), and keep what is inside the radius
 * the operator chose (never past Rule 4's five miles).
 *
 * Within that eligible set: likeness first, distance as the tiebreaker. Rent is
 * deliberately not a ranking input: putting the highest rent at the top would
 * steer selection, and the methodology sorts high to low *after* the human has
 * chosen.
 */
export function rankCandidates(
  loss: LossShape,
  records: readonly ZillowSearchRecord[],
  criteria: Partial<CandidateCriteria> = {},
): CompCandidate[] {
  const c = { ...DEFAULT_CRITERIA, ...criteria };
  const radius = Math.min(c.radiusMiles, RADIUS_BANDS.needsJustification);
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
    if (miles > radius) continue;
    const { band } = classifyDistance(miles);
    if (band === 'beyond-limit') continue;

    const homeType = r.home_type ?? null;
    const exact = beds === loss.bedrooms && baths === loss.bathrooms && Math.abs(sqft - loss.sqft) / loss.sqft <= 0.05;

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
      homeType,
      pets: Array.isArray(r.pets) ? r.pets.filter((p): p is string => typeof p === 'string').map((p) => p.toLowerCase()) : [],
      availableFrom: typeof r.available_from === 'string' && r.available_from ? r.available_from : null,
      distanceMiles: miles,
      band,
      likeness: scoreLikeness(loss, { bedrooms: beds, bathrooms: baths, sqft, homeType }, c.sqftTolerance),
      match: exact ? 'exact' : 'close',
      attribution: r.attribution ?? null,
    });
  }

  qualified.sort(
    (a, b) => b.likeness - a.likeness || a.distanceMiles - b.distanceMiles || a.zpid.localeCompare(b.zpid),
  );
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

/**
 * Regions to query for a radius. Zillow searches by region, not radius: a ZIP
 * covers roughly 2.5 mi; wider radii add the city (ZIP first so the nearest
 * listings come from the tighter region). The radius filter does the real work.
 */
export function searchRegionsFor(address: string, radiusMiles: number): string[] {
  const zip = /\b(\d{5})(?:-\d{4})?\b/.exec(address)?.[1] ?? null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const cityState =
    parts.length >= 2 ? parts.slice(-2).join(', ').replace(/\s+\d{5}(-\d{4})?$/, '').trim() || null : null;
  const regions = radiusMiles <= 2.5 ? [zip ?? cityState] : [zip, cityState];
  return [...new Set(regions.filter((r): r is string => !!r))];
}
