import { describe, expect, it } from 'vitest';
import type { CompCandidate } from '@/lib/listings/candidates';
import { filterCandidates, filterOptions, isEmptyFilter } from '@/lib/listings/filters';
import { EMPTY_FILTER } from '@/lib/listings/types';

const loss = { bedrooms: 4, bathrooms: 2 };

const c = (over: Partial<CompCandidate> = {}): CompCandidate => ({
  url: 'https://www.zillow.com/homedetails/x/1_zpid/',
  zpid: '1',
  address: '1 Main St',
  rentCents: 300_000,
  bedrooms: 4,
  bathrooms: 2,
  sqft: 2100,
  lat: 0,
  lng: 0,
  homeType: 'SINGLE_FAMILY',
  pets: [],
  availableFrom: null,
  distanceMiles: 1,
  band: 'clean',
  likeness: 1,
  match: 'exact',
  attribution: null,
  ...over,
});

const run = (list: CompCandidate[], f: Partial<typeof EMPTY_FILTER>) =>
  filterCandidates(list, { ...EMPTY_FILTER, ...f }, loss).map((x) => x.zpid);

describe('filterCandidates', () => {
  it('passes everything through an empty filter', () => {
    expect(run([c({ zpid: 'a' }), c({ zpid: 'b' })], {})).toEqual(['a', 'b']);
  });

  it('filters by home type, any of the chosen', () => {
    const list = [c({ zpid: 'a' }), c({ zpid: 'b', homeType: 'TOWNHOUSE' }), c({ zpid: 'n', homeType: null })];
    expect(run(list, { homeTypes: ['TOWNHOUSE'] })).toEqual(['b']);
    expect(run(list, { homeTypes: ['TOWNHOUSE', 'SINGLE_FAMILY'] })).toEqual(['a', 'b']);
  });

  it('requires every chosen pet kind', () => {
    const list = [c({ zpid: 'a', pets: ['dogs', 'cats'] }), c({ zpid: 'b', pets: ['dogs'] }), c({ zpid: 'n' })];
    expect(run(list, { pets: ['dogs'] })).toEqual(['a', 'b']);
    expect(run(list, { pets: ['dogs', 'cats'] })).toEqual(['a']);
  });

  it('keeps listings available on or before the date, and those with no date', () => {
    const list = [
      c({ zpid: 'early', availableFrom: '2026-10-15' }),
      c({ zpid: 'same', availableFrom: '2026-11-01' }),
      c({ zpid: 'late', availableFrom: '2026-12-01' }),
      c({ zpid: 'none', availableFrom: null }),
    ];
    expect(run(list, { availableBy: '2026-11-01' })).toEqual(['early', 'same', 'none']);
  });

  it('matches exact beds and baths on request', () => {
    const list = [c({ zpid: 'a' }), c({ zpid: 'b', bedrooms: 5 }), c({ zpid: 'd', bathrooms: 3 })];
    expect(run(list, { exactBeds: true })).toEqual(['a', 'd']);
    expect(run(list, { exactBaths: true })).toEqual(['a', 'b']);
    expect(run(list, { exactBeds: true, exactBaths: true })).toEqual(['a']);
  });

  it('combines axes and preserves order', () => {
    const list = [c({ zpid: 'a', pets: ['dogs'] }), c({ zpid: 'b', pets: ['dogs'], bedrooms: 3 }), c({ zpid: 'd', pets: ['dogs'] })];
    expect(run(list, { pets: ['dogs'], exactBeds: true })).toEqual(['a', 'd']);
  });
});

describe('filterOptions', () => {
  it('returns distinct, sorted values present', () => {
    const list = [
      c({ homeType: 'TOWNHOUSE', pets: ['dogs'] }),
      c({ homeType: 'SINGLE_FAMILY', pets: ['cats', 'dogs'] }),
      c({ homeType: 'TOWNHOUSE', pets: [] }),
      c({ homeType: null }),
    ];
    expect(filterOptions(list)).toEqual({ homeTypes: ['SINGLE_FAMILY', 'TOWNHOUSE'], pets: ['cats', 'dogs'] });
  });
  it('is empty for an empty shortlist', () => {
    expect(filterOptions([])).toEqual({ homeTypes: [], pets: [] });
  });
});

describe('isEmptyFilter', () => {
  it('is true only when nothing is set', () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
    expect(isEmptyFilter({ ...EMPTY_FILTER, homeTypes: ['CONDO'] })).toBe(false);
    expect(isEmptyFilter({ ...EMPTY_FILTER, pets: ['dogs'] })).toBe(false);
    expect(isEmptyFilter({ ...EMPTY_FILTER, availableBy: '2026-11-01' })).toBe(false);
    expect(isEmptyFilter({ ...EMPTY_FILTER, exactBeds: true })).toBe(false);
    expect(isEmptyFilter({ ...EMPTY_FILTER, exactBaths: true })).toBe(false);
  });
});
