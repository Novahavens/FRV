import 'server-only';
import type { ListingProvider, LookupResult } from './types';
import { mapZillowRecord, type ZillowRentalRecord } from './zillow-record';

/**
 * Listing metadata through Firecrawl's catalogued Zillow capability.
 *
 * Approved by Will and Lou, October 2026. Scope is deliberately narrow:
 * `properties/rental` only, for a URL the account manager has already chosen.
 * `properties/rental_search` exists and is not used — that is comp discovery,
 * which PRD FR-2 excludes outright.
 *
 * The data remains Zillow's. Records carry an attribution string, and the
 * report prints it whenever any comp was sourced this way.
 */
const ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const ZILLOW_DETAIL = /^https:\/\/www\.zillow\.com\/homedetails\/[^/]+\/\d+_zpid\/?/i;

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

      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alexandria: {
              provider: 'zillow-com',
              capability: 'properties/rental',
              options: { url: url.trim() },
            },
          }),
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        });
      } catch {
        return { ok: false, reason: 'upstream-error', message: 'The listing service did not respond. Enter the figures by hand.' };
      }

      if (!response.ok) {
        return { ok: false, reason: 'upstream-error', message: `The listing service returned ${response.status}. Enter the figures by hand.` };
      }

      const body = (await response.json()) as {
        data?: { alexandria?: Array<{ data?: ZillowRentalRecord & { records?: ZillowRentalRecord[] }; error?: { code?: string } }> };
      };

      const result = body.data?.alexandria?.[0];
      if (result?.error?.code === 'not_found') {
        return { ok: false, reason: 'not-found', message: 'That listing is no longer on Zillow. Expired listings cannot be used as comps.' };
      }

      // The single-listing capability returns the record directly; tolerate a
      // records array too, in case the contract converges with rental_search.
      const record = result?.data?.records?.[0] ?? result?.data;
      if (!record) {
        return { ok: false, reason: 'upstream-error', message: 'The listing came back empty. Enter the figures by hand.' };
      }

      return { ok: true, facts: mapZillowRecord(record) };
    },
  };
}
