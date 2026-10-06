import { describe, expect, it } from 'vitest';
import {
  LEGACY_MULTIPLIER_TIERS,
  MULTIPLIER_TIERS,
  ValidationFailedError,
  assertValidTiers,
  calculateFrv,
  formatCents,
  markupLabel,
  multiplierForTerm,
  parseMoneyToCents,
  sortHighToLow,
  tierLabel,
  tiersFromStored,
  tiersToStored,
  validate,
} from '@/lib/frv';
import type { Comp, LossProperty } from '@/lib/frv';

const coppellLoss: LossProperty = {
  claimIdentifier: 'NH-COPPELL-REF',
  address: '205 Park Meadow Way, Coppell TX 75019',
  lat: 32.9668,
  lng: -96.9903,
  bedrooms: 4,
  bathrooms: 2,
  sqft: 2100,
  termMonths: 3,
  managementFeeCents: 240_00,
  // The PRD's reference figures were produced under the original schedule.
  multiplierTiers: LEGACY_MULTIPLIER_TIERS,
};

/** Coordinates nudged to sit inside the clean radius band. */
const comp = (over: Partial<Comp> & Pick<Comp, 'id' | 'rentCents' | 'sqft'>): Comp => ({
  url: `https://www.zillow.com/homedetails/x/${over.id}_zpid/`,
  address: `${over.id} Example St, Coppell TX 75019`,
  bedrooms: 4,
  bathrooms: 2,
  furnished: false,
  lat: 32.9674,
  lng: -96.9911,
  ...over,
});

describe('multiplier tiers — defaults (October 2026: 90/80/70/60%, none from 12 months)', () => {
  it.each([
    [1, 1.9],
    [2, 1.8],
    [3, 1.7],
    [4, 1.6], [11, 1.6],
    [12, 1.0], [24, 1.0],
  ])('term of %i months → ×%f', (months, expected) => {
    expect(multiplierForTerm(months)).toBe(expected);
  });

  it('labels single-month tiers in the singular/plural, ranges and the open tier', () => {
    expect(MULTIPLIER_TIERS.map((_, i) => tierLabel(MULTIPLIER_TIERS, i))).toEqual([
      '1 month', '2 months', '3 months', '4–11 months', '12+ months',
    ]);
    expect(LEGACY_MULTIPLIER_TIERS.map((_, i) => tierLabel(LEGACY_MULTIPLIER_TIERS, i))).toEqual([
      '1–2 months', '3–5 months', '6–9 months', '10–11 months', '12+ months',
    ]);
  });

  it('still honours the legacy schedule when a claim carries it', () => {
    expect(multiplierForTerm(7, LEGACY_MULTIPLIER_TIERS)).toBe(1.25);
    expect(multiplierForTerm(2, LEGACY_MULTIPLIER_TIERS)).toBe(1.4);
  });

  it('refuses a term below one month rather than guessing', () => {
    expect(() => multiplierForTerm(0)).toThrow(RangeError);
  });

  it('prints half-points instead of rounding them away', () => {
    expect(markupLabel(1.375)).toBe('37.5%');
    expect(markupLabel(1.3125)).toBe('31.25%');
    expect(markupLabel(1)).toBe('No markup');
  });
});

describe('operator-entered schedules', () => {
  it('rejects a markdown, a non-ascending boundary and a bounded last tier', () => {
    expect(() => assertValidTiers([{ maxMonths: 2, multiplier: 0.9 }, { maxMonths: Infinity, multiplier: 1 }])).toThrow(RangeError);
    expect(() => assertValidTiers([{ maxMonths: 5, multiplier: 1.2 }, { maxMonths: 2, multiplier: 1.1 }, { maxMonths: Infinity, multiplier: 1 }])).toThrow(RangeError);
    expect(() => assertValidTiers([{ maxMonths: 2, multiplier: 1.2 }, { maxMonths: 12, multiplier: 1 }])).toThrow(RangeError);
  });

  it('round-trips through JSON with the open-ended tier as null', () => {
    const stored = tiersToStored(MULTIPLIER_TIERS);
    expect(stored.at(-1)).toEqual({ maxMonths: null, multiplier: 1 });
    expect(tiersFromStored(stored)).toEqual(MULTIPLIER_TIERS);
  });

  it('changes the figure and is reported back on the calculation', () => {
    const comps = [
      comp({ id: 'c1', rentCents: 3_835_00, sqft: 2250 }),
      comp({ id: 'c2', rentCents: 3_600_00, sqft: 2100 }),
      comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900 }),
    ];
    const custom = [{ maxMonths: 5, multiplier: 2 }, { maxMonths: Infinity, multiplier: 1 }];
    const result = calculateFrv({ ...coppellLoss, multiplierTiers: custom }, comps);
    expect(result.multiplier).toBe(2);
    expect(result.multiplierTiers).toEqual(custom);
    // 3,545 × 2 + 1,600 + 240
    expect(result.averagedFrvCents).toBe(8_930_00);
  });

  it('uses the defaults when a claim carries no schedule', () => {
    const { multiplierTiers: _omit, ...plain } = coppellLoss;
    const result = calculateFrv(plain, [
      comp({ id: 'c1', rentCents: 3_835_00, sqft: 2250 }),
      comp({ id: 'c2', rentCents: 3_600_00, sqft: 2100 }),
      comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900 }),
    ]);
    expect(result.multiplier).toBe(1.7);
    expect(result.multiplierTiers).toEqual(MULTIPLIER_TIERS);
  });
});

describe('Coppell — three comps, three-month term (PRD 12.1, legacy schedule)', () => {
  const comps = [
    comp({ id: 'c1', rentCents: 3_835_00, sqft: 2250 }),
    comp({ id: 'c2', rentCents: 3_600_00, sqft: 2100 }),
    comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900 }),
  ];
  const result = calculateFrv(coppellLoss, comps);

  it('averages the base rent to $3,545', () => {
    expect(result.averagedBaseRentCents).toBe(3_545_00);
  });

  it('averages the adjusted rent to $4,608.50', () => {
    expect(result.averagedAdjustedRentCents).toBe(4_608_50);
  });

  it('produces an averaged FRV of $6,448.50', () => {
    expect(result.averagedFrvCents).toBe(6_448_50);
    expect(formatCents(result.averagedFrvCents)).toBe('$6,448.50');
  });

  it('produces a parallel 12-month figure of $3,785', () => {
    expect(result.twelveMonthCents).toBe(3_785_00);
  });

  it('matches the per-comp column on the reference report', () => {
    expect(result.comps.map((c) => c.frvCents)).toEqual([6_825_50, 6_520_00, 6_000_00]);
  });

  it('sorts high to low and persists the position', () => {
    expect(result.comps.map((c) => c.sortPosition)).toEqual([0, 1, 2]);
    expect(result.comps[0]!.rentCents).toBe(3_835_00);
  });

  it('reaches the same figure whatever order the comps were entered in', () => {
    const shuffled = [comps[2]!, comps[0]!, comps[1]!];
    expect(calculateFrv(coppellLoss, shuffled).averagedFrvCents).toBe(6_448_50);
  });
});

describe('Camarillo — two-month term (PRD 12.2)', () => {
  const camarilloLoss: LossProperty = {
    claimIdentifier: 'NH-CAMARILLO-REF',
    address: '1710 Ramona Drive, Camarillo CA',
    lat: 34.2164,
    lng: -119.0376,
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2544,
    termMonths: 2,
    managementFeeCents: 145_00,
    multiplierTiers: LEGACY_MULTIPLIER_TIERS,
  };
  const near = { lat: 34.2189, lng: -119.0401 };
  const comps = [
    comp({ id: 'a', rentCents: 6_000_00, sqft: 2647, ...near }),
    comp({ id: 'b', rentCents: 6_000_00, sqft: 2500, ...near }),
    comp({ id: 'c', rentCents: 6_000_00, sqft: 2600, ...near }),
  ];

  it('produces $10,145 under the schedule the reference report used', () => {
    const result = calculateFrv(camarilloLoss, comps);
    expect(result.averagedFrvCents).toBe(10_145_00);
    expect(formatCents(result.averagedFrvCents)).toBe('$10,145');
  });

  it('shows the workings the adjuster expects', () => {
    const { comps: evaluated, furnitureCents } = calculateFrv(camarilloLoss, comps);
    expect(evaluated[0]!.adjustedRentCents).toBe(8_400_00);
    expect(furnitureCents).toBe(1_600_00);
  });
});

describe('rule enforcement', () => {
  const comps = [
    comp({ id: 'c1', rentCents: 3_835_00, sqft: 2250 }),
    comp({ id: 'c2', rentCents: 3_600_00, sqft: 2100 }),
    comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900 }),
  ];

  it('blocks a furnished comp and refuses to produce a number', () => {
    const withFurnished = [comps[0]!, comps[1]!, comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900, furnished: true })];
    const result = validate(coppellLoss, withFurnished);
    expect(result.passed).toBe(false);
    expect(result.events[0]!.terminal).toBe(true);
    expect(() => calculateFrv(coppellLoss, withFurnished)).toThrow(ValidationFailedError);
  });

  it('catches a furnished listing from its title even when the flag is clean', () => {
    const sneaky = [comps[0]!, comps[1]!, comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900, address: 'Executive Suite, Coppell TX' })];
    expect(validate(coppellLoss, sneaky).passed).toBe(false);
  });

  it('blocks a comp past five miles rather than widening', () => {
    const far = [comps[0]!, comps[1]!, comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900, lat: 33.15, lng: -96.99 })];
    const result = validate(coppellLoss, far);
    expect(result.passed).toBe(false);
    expect(result.events[0]!.rule).toBe('rule-4-geography');
  });

  it('warns but does not block between two and five miles', () => {
    const mid = [comps[0]!, comps[1]!, comp({ id: 'c3', rentCents: 3_200_00, sqft: 1900, lat: 33.0044, lng: -96.9903 })];
    const result = validate(coppellLoss, mid);
    expect(result.passed).toBe(true);
    expect(result.requiresJustification).toHaveLength(1);
  });

  it('does not enforce bathroom match — a 2.5-bath comp is legitimate', () => {
    const halfBath = [comp({ id: 'c1', rentCents: 3_835_00, sqft: 2250, bathrooms: 2.5 }), comps[1]!, comps[2]!];
    const result = validate(coppellLoss, halfBath);
    expect(result.events.some((e) => e.message.includes('bathroom'))).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('flags square footage outside 15%', () => {
    const big = [comp({ id: 'c1', rentCents: 3_835_00, sqft: 3000 }), comps[1]!, comps[2]!];
    expect(validate(coppellLoss, big).events.some((e) => e.rule === 'sqft-tolerance')).toBe(true);
  });

  it('requires exactly three comps', () => {
    expect(validate(coppellLoss, [comps[0]!, comps[1]!]).passed).toBe(false);
  });
});

describe('money', () => {
  it.each([
    ['$3,835', 383_500],
    ['3835', 383_500],
    ['6,448.50', 644_850],
    [3835, 383_500],
  ])('parses %s', (input, expected) => {
    expect(parseMoneyToCents(input as string | number)).toBe(expected);
  });

  it('returns null rather than guessing at junk', () => {
    expect(parseMoneyToCents('about $3.8k')).toBeNull();
    expect(parseMoneyToCents('')).toBeNull();
  });

  it('never abbreviates a figure', () => {
    expect(formatCents(10_145_00)).toBe('$10,145');
  });
});

describe('sortHighToLow', () => {
  it('does not mutate its input', () => {
    const input = [comp({ id: 'a', rentCents: 100_00, sqft: 2100 }), comp({ id: 'b', rentCents: 300_00, sqft: 2100 })];
    sortHighToLow(input);
    expect(input[0]!.id).toBe('a');
  });
});
