import type { Cents, MultiplierTier } from './types';

/**
 * PRD section 4. Every value here is a decision on record, made by Lou.
 * Changing a number in this file is a methodology change, not a code change —
 * it requires her sign-off.
 */

/**
 * Default short-term multiplier tiers, applied to base unfurnished rent.
 *
 * These are the DEFAULTS. Since October 2026 the schedule is editable per
 * claim on the intake form, and the schedule actually used is stored with the
 * calculation and printed on the report. Defaults approved by Lou, October
 * 2026: 1 month 90%, 2 months 80%, 3 months 70%, 4–11 months 60%, twelve
 * months and beyond no markup. Editable per claim.
 */
export const MULTIPLIER_TIERS: readonly MultiplierTier[] = [
  { maxMonths: 1, multiplier: 1.9 },
  { maxMonths: 2, multiplier: 1.8 },
  { maxMonths: 3, multiplier: 1.7 },
  { maxMonths: 11, multiplier: 1.6 },
  { maxMonths: Infinity, multiplier: 1.0 },
];

/**
 * The schedule in force before October 2026. Kept for reading calculations
 * stored without their own schedule, and as the arithmetic reference the PRD's
 * example reports were produced with.
 */
export const LEGACY_MULTIPLIER_TIERS: readonly MultiplierTier[] = [
  { maxMonths: 2, multiplier: 1.4 },
  { maxMonths: 5, multiplier: 1.3 },
  { maxMonths: 9, multiplier: 1.25 },
  { maxMonths: 11, multiplier: 1.1 },
  { maxMonths: Infinity, multiplier: 1.0 },
];

/**
 * Flat monthly furniture, housewares and appliances by bedroom count.
 * Does not scale with lease length: a one-month and a nine-month placement
 * carry the same figure.
 */
export const FURNITURE_BY_BEDROOM: Readonly<Record<number, Cents>> = {
  1: 1_059_00,
  2: 1_267_00,
  3: 1_456_00,
  4: 1_600_00,
  5: 1_746_00,
};

export const DEFAULT_MANAGEMENT_FEE_CENTS: Cents = 240_00;

/** Exactly three. Not two, not five. */
export const REQUIRED_COMP_COUNT = 3;

/** Square footage tolerance against the loss property. */
export const SQFT_TOLERANCE = 0.15;

/** Concentric radius bands, in miles. Past the last one the system halts. */
export const RADIUS_BANDS = {
  clean: 1,
  acceptable: 2,
  needsJustification: 5,
} as const;

/**
 * Radii the operator can choose for "Find comparables", in miles. The first
 * is the default; the last equals the Rule 4 limit, because a comp past it is
 * blocked by the engine and would be a shortlist of nothing. Widening is a
 * deliberate click, never automatic (October 2026).
 */
export const SEARCH_RADIUS_STEPS = [2.5, 3, 4, 5] as const;
export type SearchRadiusMiles = (typeof SEARCH_RADIUS_STEPS)[number];
export const DEFAULT_SEARCH_RADIUS_MILES: SearchRadiusMiles = 2.5;

/**
 * Title and description keywords that mark a listing as short-term furnished
 * stock. Rule 1 is a hard block, so this list is deliberately broad: a false
 * positive costs the operator one replacement, a false negative costs the
 * carrier relationship.
 */
export const FURNISHED_KEYWORDS = [
  'furnished',
  'airbnb',
  'vrbo',
  'all utilities included',
  'utilities included',
  'executive suite',
  'per night',
  'nightly',
  'weekly',
  'short term',
  'short-term',
  'corporate housing',
  'move-in ready',
] as const;
