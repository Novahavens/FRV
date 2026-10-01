import type { ListingFacts } from './types';

/**
 * Map a Firecrawl `zillow-com` rental record to ListingFacts.
 *
 * Pure and separate from the network call so it can be tested against a
 * captured payload. Shape observed live on 1 October 2026, schema_version 1.1.0:
 *
 *   { address: { text }, rent, beds, baths, sqft, lat, lon,
 *     status: "FOR_RENT", rent_basis, attribution, description?, furnished? }
 *
 * Every field is read defensively. A provider that changes its schema should
 * degrade to manual entry, never to a wrong number on a report.
 */
export interface ZillowRentalRecord {
  address?: { text?: string | null; line1?: string | null } | null;
  rent?: number | null;
  rent_basis?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lat?: number | null;
  lon?: number | null;
  status?: string | null;
  furnished?: boolean | null;
  description?: string | null;
  attribution?: string | null;
}

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function mapZillowRecord(record: ZillowRentalRecord): ListingFacts {
  const rent = finite(record.rent);

  return {
    address: record.address?.text?.trim() || record.address?.line1?.trim() || null,
    // Whole dollars upstream; cents everywhere inside the engine.
    rentCents: rent != null ? Math.round(rent * 100) : null,
    bedrooms: finite(record.beds),
    bathrooms: finite(record.baths),
    sqft: finite(record.sqft),
    lat: finite(record.lat),
    lng: finite(record.lon),
    furnished: typeof record.furnished === 'boolean' ? record.furnished : null,
    description: record.description ?? null,
    active: record.status === 'FOR_RENT',
    attribution: record.attribution ?? null,
    source: 'firecrawl-zillow',
  };
}

/**
 * Rent that includes required monthly fees is not base rent.
 *
 * Zillow marks this with rent_basis. Using it unexamined would inflate the
 * base the multiplier runs against, so the operator is told rather than the
 * figure being silently accepted.
 */
export function rentIncludesFees(record: ZillowRentalRecord): boolean {
  return record.rent_basis === 'list_price_including_required_monthly_fees';
}
