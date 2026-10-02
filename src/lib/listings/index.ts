import 'server-only';
import { createFirecrawlProvider } from './firecrawl';
import type { ListingProvider, LookupResult } from './types';

export type { ListingFacts, LookupResult, ListingSource } from './types';

/**
 * Firecrawl when FIRECRAWL_API_KEY is set, otherwise a manual provider that
 * politely declines and the form falls back to hand entry.
 */
const manual: ListingProvider = {
  name: 'manual',
  async lookup(): Promise<LookupResult> {
    return { ok: false, reason: 'not-configured', message: 'Listing lookup is off. Enter the figures by hand.' };
  },
};

export function listingProvider(): ListingProvider {
  const key = process.env.FIRECRAWL_API_KEY;
  return key ? createFirecrawlProvider(key) : manual;
}
