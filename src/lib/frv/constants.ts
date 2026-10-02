import type { Cents } from './types';

/**
 * PRD section 4. Every value here is a decision on record, made by Lou.
 * Changing a number in this file is a methodology change, not a code change —
 * it requires her sign-off and it will break the fixtures in tests/.
 */

/** Short-term multiplier tiers, applied to base unfurnished rent. */
export const MULTIPLIER_TIERS = [
  { maxMonths: 2, multiplier: 1.4 },
  { maxMonths: 5, multiplier: 1.3 },
  { maxMonths: 9, multiplier: 1.25 },
  { maxMonths: 11, multiplier: 1.1 },
  { maxMonths: Infinity, multiplier: 1.0 },
] as const;

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
