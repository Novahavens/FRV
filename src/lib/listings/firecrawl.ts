import 'server-only';
import { RADIUS_BANDS } from '@/lib/frv';
import { DEFAULT_CRITERIA, rankCandidates, searchLocationFor, type ZillowSearchRecord } from './candidates';
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

/** Pages of 41 to pull before filtering. Two covers a ZIP comfortably; each page is one credit charge. */
const SEARCH_PAGES = 2;

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
      const location = searchLocationFor(query.address);
      if (!location) {
        return { ok: false, reason: 'no-region', message: 'Could not read a ZIP or city from the loss address. Add one and try again.' };
      }

      // The upstream filters are coarse on purpose: the shortlist criteria
      // (±1 bed, ±1 bath, ±15% sqft, radius bands) are applied here, in code
      // that is tested, rather than trusting a search index's interpretation.
      const options: Record<string, unknown> = {
        location,
        beds_min: Math.max(0, query.bedrooms - DEFAULT_CRITERIA.bedroomVariance),
        baths_min: Math.max(0, query.bathrooms - DEFAULT_CRITERIA.bathroomVariance),
        sort: 'relevance',
      };

      const records: ZillowSearchRecord[] = [];
      let cursor: string | null | undefined;
      for (let page = 0; page < SEARCH_PAGES; page++) {
        const res = await alexandria<ZillowSearchRecord>(
          apiKey,
          'properties/rental_search',
          cursor ? { ...options, cursor } : options,
          20_000,
        );
        if (!res.ok) {
          if (records.length) break; // keep what we have
          return {
            ok: false,
            reason: 'upstream-error',
            message: res.status
              ? `The listing service returned ${res.status}. Paste listing URLs by hand.`
              : 'The listing service did not respond. Paste listing URLs by hand.',
          };
        }
        const pageRecords = res.result?.data?.records ?? [];
        records.push(...pageRecords);
        cursor = res.result?.data?.next_cursor;
        if (!cursor || pageRecords.length === 0) break;
      }

      const candidates = rankCandidates(query, records);
      const widened = candidates.some((c) => c.distanceMiles > RADIUS_BANDS.acceptable);
      const attribution = candidates.find((c) => c.attribution)?.attribution ?? records.find((r) => r.attribution)?.attribution ?? null;

      return { ok: true, candidates, searched: location, widened, attribution };
    },
  };
}
