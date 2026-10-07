import { describe, expect, it } from 'vitest';
import { rankCandidates, scoreLikeness, searchLocationFor, searchRegionsFor, type ZillowSearchRecord } from '@/lib/listings/candidates';

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

describe('rankCandidates — radius', () => {
  it('respects the radius the operator chose', () => {
    const r = fit({ lat: milesNorth(2.8) });
    expect(rankCandidates(loss, [r], { radiusMiles: 2.5 })).toHaveLength(0);
    expect(rankCandidates(loss, [r], { radiusMiles: 3 })).toHaveLength(1);
  });

  it('defaults to 2.5 miles and never widens on its own', () => {
    expect(rankCandidates(loss, [fit({ lat: milesNorth(2.8) })])).toHaveLength(0);
  });

  it('never goes past five miles even when asked for five', () => {
    expect(rankCandidates(loss, [fit({ lat: milesNorth(5.5) })], { radiusMiles: 5 })).toHaveLength(0);
    expect(rankCandidates(loss, [fit({ lat: milesNorth(4.8) })], { radiusMiles: 5 })).toHaveLength(1);
  });
});

describe('rankCandidates — ordering', () => {
  it('ranks an exact 4/2 match 1.5 mi away above a 5/3 match 0.2 mi away', () => {
    const out = rankCandidates(loss, [
      fit({ zpid: 'close', beds: 5, baths: 3, sqft: 2400, lat: milesNorth(0.2) }),
      fit({ zpid: 'exact', beds: 4, baths: 2, sqft: 2100, lat: milesNorth(1.5) }),
    ]);
    expect(out.map((c) => c.zpid)).toEqual(['exact', 'close']);
  });

  it('breaks ties between equal matches by distance', () => {
    const out = rankCandidates(loss, [
      fit({ zpid: 'far', lat: milesNorth(1.8) }),
      fit({ zpid: 'near', lat: milesNorth(0.4) }),
    ]);
    expect(out[0]!.likeness).toBe(out[1]!.likeness);
    expect(out.map((c) => c.zpid)).toEqual(['near', 'far']);
  });

  it('orders by likeness, not highest rent', () => {
    const out = rankCandidates(loss, [
      fit({ zpid: 'x', lat: milesNorth(1.5), rent: 9000 }),
      fit({ zpid: 'y', lat: milesNorth(0.2), rent: 3000 }),
    ]);
    expect(out.map((c) => c.zpid)).toEqual(['y', 'x']);
  });

  it('prefers a single family home over a townhouse, all else equal', () => {
    const out = rankCandidates(loss, [
      fit({ zpid: 't', home_type: 'TOWNHOUSE', lat: milesNorth(0.1) }),
      fit({ zpid: 's', home_type: 'SINGLE_FAMILY', lat: milesNorth(1) }),
    ]);
    expect(out.map((c) => c.zpid)).toEqual(['s', 't']);
  });
});

describe('match and field mapping', () => {
  it("is 'exact' only for equal beds and baths with sqft within 5%", () => {
    const m = (over: Partial<ZillowSearchRecord>) => rankCandidates(loss, [fit(over)])[0]!.match;
    expect(m({ sqft: 2100 })).toBe('exact');
    expect(m({ sqft: 2200 })).toBe('exact'); // 4.8%
    expect(m({ sqft: 2250 })).toBe('close'); // 7.1%
    expect(m({ beds: 5, sqft: 2100 })).toBe('close');
    expect(m({ baths: 2.5, sqft: 2100 })).toBe('close');
  });

  it('maps pets and availability', () => {
    const [c] = rankCandidates(loss, [fit({ pets: ['Dogs', 'CATS'], available_from: '2026-11-01' })]);
    expect(c).toMatchObject({ pets: ['dogs', 'cats'], availableFrom: '2026-11-01' });
    const [d] = rankCandidates(loss, [fit()]);
    expect(d).toMatchObject({ pets: [], availableFrom: null });
  });
});

describe('scoreLikeness', () => {
  it('is 1 for an identical single family home and stays within 0..1', () => {
    expect(scoreLikeness(loss, { bedrooms: 4, bathrooms: 2, sqft: 2100, homeType: 'SINGLE_FAMILY' })).toBeCloseTo(1);
    const edge = scoreLikeness(loss, { bedrooms: 5, bathrooms: 3, sqft: 2415, homeType: null });
    expect(edge).toBeGreaterThanOrEqual(0);
    expect(edge).toBeLessThan(0.01);
  });
  it('scores a half bath off at 0.15 and a full bath off at 0', () => {
    const base = { bedrooms: 4, sqft: 2100, homeType: null };
    expect(scoreLikeness(loss, { ...base, bathrooms: 2.5 })).toBeCloseTo(0.35 + 0.15 + 0.3);
    expect(scoreLikeness(loss, { ...base, bathrooms: 3 })).toBeCloseTo(0.35 + 0.3);
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

describe('searchRegionsFor', () => {
  const addr = '205 Park Meadow Way, Coppell, TX 75019';
  it('uses the ZIP only at 2.5 miles', () => {
    expect(searchRegionsFor(addr, 2.5)).toEqual(['75019']);
  });
  it('adds the city, ZIP first, at wider radii', () => {
    expect(searchRegionsFor(addr, 4)).toEqual(['75019', 'Coppell, TX']);
  });
  it('falls back to the city when there is no ZIP, without duplicating', () => {
    expect(searchRegionsFor('205 Park Meadow Way, Coppell, TX', 2.5)).toEqual(['Coppell, TX']);
    expect(searchRegionsFor('205 Park Meadow Way, Coppell, TX', 4)).toEqual(['Coppell, TX']);
  });
  it('returns nothing when neither can be read', () => {
    expect(searchRegionsFor('Park Meadow Way', 3)).toEqual([]);
  });
});
