import 'server-only';
import { createFirecrawlProvider } from './firecrawl';
import type { ListingProvider, LookupResult } from './types';

export type { ListingFacts, LookupResult, ListingSource } from './types';

/**
 * The configured listing provider, or a manual one that politely declines.
 *
 * One env var turns enrichment on or off. If a licensed source is approved
 * later, it implements ListingProvider and replaces Firecrawl here without
 * any change to the form, the engine or the report.
 */
const manual: ListingProvider = {
  name: 'manual',
  async lookup(): Promise<LookupResult> {
    return { ok: false, reason: 'not-configured', message: 'Listing lookup is off. Enter the figures by hand.' };
  },
};

export function listingProvider(): ListingProvider {
  const key = process.env.FIRECRAWL_API_KEY;
  const enabled = (process.env.LISTING_PROVIDER ?? 'firecrawl') === 'firecrawl';
  return enabled && key ? createFirecrawlProvider(key) : manual;
}
