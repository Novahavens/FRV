import { describe, expect, it } from 'vitest';
import { rankCandidates, searchLocationFor, type ZillowSearchRecord } from '@/lib/listings/candidates';

/** The Coppell reference loss. */
const loss = { lat: 32.9668, lng: -96.9903, bedrooms: 4, bathrooms: 2, sqft: 2100 };

/** A record ~0.5 mi away that fits on every axis. */
const fit = (over: Partial<ZillowSearchRecord> = {}): ZillowSearchRecord => ({
  url: 'https://www.zillow.com/homedetails/1052-Village-Pkwy-Coppell-TX-75019/26965000_zpid/',
  zpid: '26965000',
  address: { text: '1052 Village Pkwy, Coppell, TX 75019' },
  rent: 3835, beds: 4, baths: 2, sqft: 2250, lat: 32.9674, lon: -96.9911,
  status: 'FOR_RENT', is_building: false, home_type: 'SINGLE_FAMILY',
  attribution: 'Data provided by Zillow, Inc.',
  ...over,
});

/** Shift a record by roughly `miles` due north. */
const milesNorth = (miles: number) => loss.lat + miles / 69;

describe('rankCandidates — what qualifies', () => {
  it('keeps a like-for-like active house within two miles', () => {
    const [c] = rankCandidates(loss, [fit()]);
    expect(c).toMatchObject({ bedrooms: 4, bathrooms: 2, rentCents: 383_500, band: 'clean' });
    expect(c!.distanceMiles).toBeLessThan(1);
  });

  it('allows one bedroom and one bathroom of variance, no more', () => {
    expect(rankCandidates(loss, [fit({ beds: 5, zpid: 'a' }), fit({ beds: 3, zpid: 'b' })])).toHaveLength(2);
    expect(rankCandidates(loss, [fit({ beds: 6 })])).toHaveLength(0);
    expect(rankCandidates(loss, [fit({ baths: 3, zpid: 'c' })])).toHaveLength(1);
    expect(rankCandidates(loss, [fit({ baths: 3.5 })])).toHaveLength(0);
  });

  it('applies the 15% square footage tolerance', () => {
    expect(rankCandidates(loss, [fit({ sqft: 2400 })])).toHaveLength(1); // 14.3%
    expect(rankCandidates(loss, [fit({ sqft: 2500 })])).toHaveLength(0); // 19%
  });

  it('excludes apartment communities, delisted records and incomplete cards', () => {
    expect(rankCandidates(loss, [fit({ is_building: true })])).toHaveLength(0);
    expect(rankCandidates(loss, [fit({ status: 'OFF_MARKET' })])).toHaveLength(0);
    expect(rankCandidates(loss, [fit({ sqft: null })])).toHaveLength(0);
    expect(rankCandidates(loss, [fit({ url: 'https://www.zillow.com/apartments/x/' })])).toHaveLength(0);
  });

  it('never offers anything past five miles — the engine would block it', () => {
    expect(rankCandidates(loss, [fit({ lat: milesNorth(5.5) })])).toHaveLength(0);
  });

  it('dedupes by zpid', () => {
    expect(rankCandidates(loss, [fit(), fit()])).toHaveLength(1);
  });
});

describe('rankCandidates — geography', () => {
  const near = (n: number) => Array.from({ length: n }, (_, i) => fit({ zpid: `n${i}`, lat: milesNorth(0.3 + i * 0.1) }));
  const far = (n: number) => Array.from({ length: n }, (_, i) => fit({ zpid: `f${i}`, lat: milesNorth(3 + i * 0.2) }));

  it('stays inside two miles when six or more fit there', () => {
    const out = rankCandidates(loss, [...near(6), ...far(3)]);
    expect(out).toHaveLength(6);
    expect(out.every((c) => c.distanceMiles <= 2)).toBe(true);
  });

  it('widens to five miles when the near set is thin, and says so by band', () => {
    const out = rankCandidates(loss, [...near(2), ...far(3)]);
    expect(out).toHaveLength(5);
    expect(out.filter((c) => c.band === 'needs-justification')).toHaveLength(3);
  });

  it('orders closest first, not highest rent first', () => {
    const out = rankCandidates(loss, [fit({ zpid: 'x', lat: milesNorth(1.5), rent: 9000 }), fit({ zpid: 'y', lat: milesNorth(0.2), rent: 3000 })]);
    expect(out.map((c) => c.zpid)).toEqual(['y', 'x']);
  });
});

describe('searchLocationFor', () => {
  it('prefers the ZIP', () => {
    expect(searchLocationFor('205 Park Meadow Way, Coppell TX 75019')).toBe('75019');
    expect(searchLocationFor('1 Main St, Camarillo, CA 93010-1234')).toBe('93010');
  });
  it('falls back to city and state', () => {
    expect(searchLocationFor('205 Park Meadow Way, Coppell, TX')).toBe('Coppell, TX');
  });
  it('gives up on an address with neither', () => {
    expect(searchLocationFor('Park Meadow Way')).toBeNull();
  });
});
