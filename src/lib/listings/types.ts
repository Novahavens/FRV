import type { CompCandidate, LossShape } from './candidates';

export type { CompCandidate } from './candidates';

/**
 * Facts about one listing the account manager has already chosen.
 *
 * A provider's first job is to save retyping. Every field here is a suggestion
 * the operator can overwrite, and the audit record says which ones they did.
 *
 * Since October 2026 a provider may also *search* — see `search()` below — but
 * only to produce a shortlist. It never ranks by rent, never fills a comp slot
 * on its own, and comp selection stays human because geography is the single
 * largest source of error in an FRV (PRD 4.6).
 */
export interface ListingFacts {
  address: string | null;
  rentCents: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  lat: number | null;
  lng: number | null;
  /** null means the provider could not say — Rule 1 still runs its keyword check. */
  furnished: boolean | null;
  /** Listing text, passed to the Rule 1 keyword scan. */
  description: string | null;
  /** True only when the listing is currently for rent. An expired comp is not evidence. */
  active: boolean;
  /** Attribution the source requires on anything that displays its data. */
  attribution: string | null;
  source: ListingSource;
}

export type ListingSource = 'firecrawl-zillow' | 'manual';

export type LookupResult =
  | { ok: true; facts: ListingFacts }
  | { ok: false; reason: 'not-configured' | 'not-found' | 'unsupported-url' | 'upstream-error'; message: string };

/** What a comp search needs to know about the loss property. */
export interface SearchQuery extends LossShape {
  /** Free-text loss address; the provider derives a search region from it. */
  address: string;
  /**
   * How far from the loss to look, in miles. One of SEARCH_RADIUS_STEPS; the
   * operator chooses it and widens deliberately. Never more than the Rule 4
   * limit.
   */
  radiusMiles: number;
}

export type SearchResult =
  | {
      ok: true;
      /** Ranked by likeness to the loss, distance as the tiebreaker. Already inside `radiusMiles`. */
      candidates: CompCandidate[];
      /** The region text the provider searched (a ZIP or "City, ST"). */
      searched: string;
      /** The radius the operator asked for and the results were filtered to. */
      radiusMiles: number;
      /** How many provider pages were pulled; wider radii cost more. */
      pagesFetched: number;
      attribution: string | null;
    }
  | { ok: false; reason: 'not-configured' | 'no-region' | 'upstream-error'; message: string };

/**
 * Operator-side narrowing of a shortlist. Everything here is a fact Zillow's
 * search already returns, so filtering is instant and costs nothing. Amenities
 * (garage, pool, laundry…) are deliberately absent: the search records do not
 * carry them, and fetching details per listing was declined for cost.
 */
export interface CandidateFilter {
  /** Zillow home types to keep, e.g. ['SINGLE_FAMILY', 'TOWNHOUSE']. Empty = all. */
  homeTypes: string[];
  /** Pet kinds the listing must allow, e.g. ['dogs']. Empty = no requirement. */
  pets: string[];
  /** Keep listings available on or before this ISO date (YYYY-MM-DD). null = any. */
  availableBy: string | null;
  /** Only the loss property's exact bedroom count. */
  exactBeds: boolean;
  /** Only the loss property's exact bathroom count. */
  exactBaths: boolean;
}

export const EMPTY_FILTER: CandidateFilter = {
  homeTypes: [],
  pets: [],
  availableBy: null,
  exactBeds: false,
  exactBaths: false,
};

export interface ListingProvider {
  readonly name: ListingSource;
  /** Facts for one listing URL the operator chose. */
  lookup(url: string): Promise<LookupResult>;
  /** A shortlist of active rentals near the loss that fit its size. Suggestions only. */
  search(query: SearchQuery): Promise<SearchResult>;
}
