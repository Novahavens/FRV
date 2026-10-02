/**
 * Facts about one listing the account manager has already chosen.
 *
 * A provider's only job is to save retyping. It is never asked to search, rank
 * or recommend — comp selection stays human because geography is the single
 * largest source of error in an FRV (PRD 4.6). Every field here is a
 * suggestion the operator can overwrite, and the audit record says which ones
 * they did.
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

export interface ListingProvider {
  readonly name: ListingSource;
  lookup(url: string): Promise<LookupResult>;
}
