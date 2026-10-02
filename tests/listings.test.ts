import { describe, expect, it } from 'vitest';
import { mapZillowRecord, rentIncludesFees } from '@/lib/listings/zillow-record';

/** Captured from Firecrawl's zillow-com capability, 1 October 2026. */
const live = {
  address: { text: '1025 Basilwood Dr, Coppell, TX 75019', line1: '1025 Basilwood Dr' },
  rent: 3700,
  rent_basis: 'list_price',
  beds: 4,
  baths: 4,
  sqft: 3001,
  lat: 32.97435,
  lon: -96.955765,
  status: 'FOR_RENT',
  attribution: 'Data provided by Zillow, Inc. (https://www.zillow.com/)',
};

describe('mapZillowRecord', () => {
  const facts = mapZillowRecord(live);

  it('converts whole-dollar rent to cents', () => {
    expect(facts.rentCents).toBe(370_000);
  });

  it('maps size and location', () => {
    expect(facts).toMatchObject({ bedrooms: 4, bathrooms: 4, sqft: 3001, lat: 32.97435, lng: -96.955765 });
  });

  it('marks a for-rent listing active', () => {
    expect(facts.active).toBe(true);
  });

  it('keeps the attribution the source requires', () => {
    expect(facts.attribution).toContain('Zillow');
  });

  it('leaves furnished unknown rather than guessing false', () => {
    expect(facts.furnished).toBeNull();
  });

  it('treats a delisted record as inactive', () => {
    expect(mapZillowRecord({ ...live, status: 'OFF_MARKET' }).active).toBe(false);
  });

  it('degrades to nulls on a changed schema instead of inventing numbers', () => {
    const facts = mapZillowRecord({ rent: Number.NaN, beds: undefined, address: null });
    expect(facts).toMatchObject({ rentCents: null, bedrooms: null, address: null });
  });
});

describe('rentIncludesFees', () => {
  it('flags rent that bundles required monthly fees', () => {
    expect(rentIncludesFees({ rent_basis: 'list_price_including_required_monthly_fees' })).toBe(true);
    expect(rentIncludesFees(live)).toBe(false);
  });
});
