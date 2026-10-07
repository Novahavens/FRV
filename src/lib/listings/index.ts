import 'server-only';
import { createFirecrawlProvider } from './firecrawl';
import type { ListingProvider, LookupResult, SearchResult } from './types';

export type { ListingFacts, LookupResult, ListingSource, SearchQuery, SearchResult } from './types';
export type { CompCandidate } from './candidates';
export type { CandidateFilter } from './types';
export { EMPTY_FILTER } from './types';
export { filterCandidates, filterOptions, isEmptyFilter } from './filters';

/**
 * Firecrawl when FIRECRAWL_API_KEY is set, otherwise a manual provider that
 * politely declines and the form falls back to hand entry.
 */
const manual: ListingProvider = {
  name: 'manual',
  async lookup(): Promise<LookupResult> {
    return { ok: false, reason: 'not-configured', message: 'Listing lookup is off. Enter the figures by hand.' };
  },
  async search(): Promise<SearchResult> {
    return { ok: false, reason: 'not-configured', message: 'Comp search is off. Paste listing URLs by hand.' };
  },
};

export function listingProvider(): ListingProvider {
  const key = process.env.FIRECRAWL_API_KEY;
  return key ? createFirecrawlProvider(key) : manual;
}
