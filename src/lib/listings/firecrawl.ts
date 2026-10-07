import 'server-only';
import { DEFAULT_CRITERIA, rankCandidates, searchRegionsFor, type ZillowSearchRecord } from './candidates';
import type { ListingProvider, LookupResult, SearchQuery, SearchResult } from './types';
import { mapZillowRecord, type ZillowRentalRecord } from './zillow-record';

/**
 * Listing metadata through Firecrawl's catalogued Zillow capability.
 *
 * Two capabilities, both approved by Will and Lou (October 2026):
 *
 *   `properties/rental`        — facts for one listing the operator chose.
 *   `properties/rental_search` — a shortlist of nearby active rentals that fit
 *                                the loss property. Suggestions only: the
 *                                operator picks, and picking runs `rental` on
 *                                that one listing so Rule 1 sees the full text.
 *
 * The data remains Zillow's. Records carry an attribution string, and the
 * report prints it whenever any comp was sourced this way.
 */
const ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const ZILLOW_DETAIL = /^https:\/\/www\.zillow\.com\/homedetails\/[^/]+\/\d+_zpid\/?/i;

/**
 * Pages of 41 to pull per region before filtering (5 credits each). Wider radii
 * pull more, capped overall. Zillow has no radius search, only regions (ZIP,
 * city, state), so past the city coverage thins: a 100-mile search samples the
 * first pages of a state-wide, relevance-sorted list, not everything in range.
 * The furnished-exclusion pages below count against the same cap.
 */
const pagesPerRegion = (radiusMiles: number) => (radiusMiles <= 2.5 ? 2 : radiusMiles <= 5 ? 3 : 4);
const MAX_TOTAL_PAGES = 10;

type AlexandriaResponse<T> = {
  data?: {
    alexandria?: Array<{
      data?: T & { records?: T[]; next_cursor?: string | null };
      error?: { code?: string; message?: string };
    }>;
  };
};

async function alexandria<T>(
  apiKey: string,
  capability: string,
  options: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: true; result: NonNullable<NonNullable<AlexandriaResponse<T>['data']>['alexandria']>[number] | undefined } | { ok: false; status?: number }> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alexandria: { provider: 'zillow-com', capability, options } }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch {
    return { ok: false };
  }
  if (!response.ok) return { ok: false, status: response.status };
  const body = (await response.json()) as AlexandriaResponse<T>;
  return { ok: true, result: body.data?.alexandria?.[0] };
}

export function createFirecrawlProvider(apiKey: string): ListingProvider {
  return {
    name: 'firecrawl-zillow',

    async lookup(url: string): Promise<LookupResult> {
      if (!ZILLOW_DETAIL.test(url.trim())) {
        return {
          ok: false,
          reason: 'unsupported-url',
          message: 'Paste a Zillow listing URL (zillow.com/homedetails/…). Other sources are entered by hand.',
        };
      }

      const res = await alexandria<ZillowRentalRecord>(apiKey, 'properties/rental', { url: url.trim() }, 15_000);
      if (!res.ok) {
        return {
          ok: false,
          reason: 'upstream-error',
          message: res.status
            ? `The listing service returned ${res.status}. Enter the figures by hand.`
            : 'The listing service did not respond. Enter the figures by hand.',
        };
      }

      if (res.result?.error?.code === 'not_found') {
        return { ok: false, reason: 'not-found', message: 'That listing is no longer on Zillow. Expired listings cannot be used as comps.' };
      }

      // The single-listing capability returns the record directly; tolerate a
      // records array too, in case the contract converges with rental_search.
      const record = res.result?.data?.records?.[0] ?? res.result?.data;
      if (!record) {
        return { ok: false, reason: 'upstream-error', message: 'The listing came back empty. Enter the figures by hand.' };
      }

      return { ok: true, facts: mapZillowRecord(record) };
    },

    async search(query: SearchQuery): Promise<SearchResult> {
      const regions = searchRegionsFor(query.address, query.radiusMiles);
      if (regions.length === 0) {
        return { ok: false, reason: 'no-region', message: 'Could not read a ZIP or city from the loss address. Add one and try again.' };
      }

      const perRegion = pagesPerRegion(query.radiusMiles);
      const records: ZillowSearchRecord[] = [];
      // Zillow's `furnished` option can only restrict TO furnished (true); false
      // or null does not filter. Unfurnished-only is therefore a subtraction:
      // fetch one furnished page per region and drop those zpids from the results.
      // Best effort: if that call fails we carry on, and Rule 1's full-text check
      // on pick remains the gate.
      const furnishedZpids = new Set<string>();
      let pagesFetched = 0;
      let failure: { status?: number } | null = null;

      // The upstream filters are coarse on purpose: the shortlist criteria
      // (±1 bed, ±1 bath, ±15% sqft, radius) are applied in rankCandidates, in
      // code that is tested, rather than trusting a search index's reading.
      regionLoop: for (const location of regions) {
        const options: Record<string, unknown> = {
          location,
          beds_min: Math.max(0, query.bedrooms - DEFAULT_CRITERIA.bedroomVariance),
          baths_min: Math.max(0, query.bathrooms - DEFAULT_CRITERIA.bathroomVariance),
          sort: 'relevance',
        };
        if (pagesFetched < MAX_TOTAL_PAGES) {
          const furnished = await alexandria<ZillowSearchRecord>(
            apiKey,
            'properties/rental_search',
            { ...options, furnished: true },
            20_000,
          );
          if (furnished.ok) {
            pagesFetched++;
            for (const r of furnished.result?.data?.records ?? []) {
              if (r.zpid != null) furnishedZpids.add(String(r.zpid));
            }
          }
        }
        let cursor: string | null | undefined;
        for (let page = 0; page < perRegion; page++) {
          if (pagesFetched >= MAX_TOTAL_PAGES) break regionLoop;
          const res = await alexandria<ZillowSearchRecord>(
            apiKey,
            'properties/rental_search',
            cursor ? { ...options, cursor } : options,
            20_000,
          );
          if (!res.ok) {
            failure = { status: res.status };
            break regionLoop;
          }
          pagesFetched++;
          const pageRecords = res.result?.data?.records ?? [];
          records.push(...pageRecords);
          cursor = res.result?.data?.next_cursor;
          if (!cursor || pageRecords.length === 0) break;
        }
      }

      // Keep what we have if anything came back before the failure.
      if (failure && records.length === 0) {
        return {
          ok: false,
          reason: 'upstream-error',
          message: failure.status
            ? `The listing service returned ${failure.status}. Paste listing URLs by hand.`
            : 'The listing service did not respond. Paste listing URLs by hand.',
        };
      }

      const seen = new Set<string>();
      const unique = records.filter((r) => {
        if (r.zpid != null && furnishedZpids.has(String(r.zpid))) return false;
        const key = r.zpid != null ? String(r.zpid) : r.url ?? '';
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const candidates = rankCandidates(query, unique, { radiusMiles: query.radiusMiles });
      const attribution = candidates.find((c) => c.attribution)?.attribution ?? unique.find((r) => r.attribution)?.attribution ?? null;

      return { ok: true, candidates, searched: regions.join(' + '), radiusMiles: query.radiusMiles, pagesFetched, attribution };
    },
  };
}
