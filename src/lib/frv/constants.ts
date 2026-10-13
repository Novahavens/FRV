import type { Cents, MultiplierTier } from './types';

/**
 * PRD section 4. Every value here is a decision on record, made by Lou.
 * Changing a number in this file is a methodology change, not a code change —
 * it requires her sign-off.
 */

/**
 * Short-term multiplier tiers, applied to base unfurnished rent. Locked: the
 * intake form shows this schedule read-only and the server ignores any schedule
 * a client sends. Approved by Lou, 12 October 2026, as Alacrity's percentages:
 * 1–2 months 40%, 3–5 months 30%, 6–9 months 25%, 10–11 months 10%, and 10%
 * from twelve months (Fazal's call, the same band as 10–11).
 *
 * Changing a value here moves only claims created after the change. Stored
 * calculations keep the schedule they were locked with.
 */
export const MULTIPLIER_TIERS: readonly MultiplierTier[] = [
  { maxMonths: 2, multiplier: 1.4 },
  { maxMonths: 5, multiplier: 1.3 },
  { maxMonths: 9, multiplier: 1.25 },
  { maxMonths: 11, multiplier: 1.1 },
  { maxMonths: Infinity, multiplier: 1.1 },
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
 *
 * 1–5 are the original rates. 6–10 were added in October 2026 (Lou, via
 * Fazal): each continues from 5 bedrooms at the average step ratio of the
 * original table, (1,746 / 1,059)^(1/4) ≈ 1.1332, rounded to whole dollars.
 * They are stored as fixed figures, not computed, so a report can never print
 * a rate the engine did not use.
 */
export const FURNITURE_BY_BEDROOM: Readonly<Record<number, Cents>> = {
  1: 1_059_00,
  2: 1_267_00,
  3: 1_456_00,
  4: 1_600_00,
  5: 1_746_00,
  6: 1_978_00,
  7: 2_242_00,
  8: 2_540_00,
  9: 2_879_00,
  10: 3_262_00,
};

/** Loss bedroom counts the methodology covers: one per furniture rate. */
export const MAX_LOSS_BEDROOMS = 10;

/**
 * The management fee is retired (October 2026, Lou): new FRVs carry none. The
 * $240 figure survives only in the PRD reference fixtures and in calculations
 * stored before the change, which render from their stored figures.
 */
export const LEGACY_MANAGEMENT_FEE_CENTS: Cents = 240_00;

/** Exactly three. Not two, not five. */
export const REQUIRED_COMP_COUNT = 3;

/** Square footage tolerance against the loss property. */
export const SQFT_TOLERANCE = 0.15;

/**
 * Concentric radius bands, in miles. Under 1 is clean, 1–2 acceptable, 2–5
 * needs a written justification. 5–100 is the extended band (Fazal, October
 * 2026): permitted without justification, shown in red as a cue and noted on
 * the record. Past `limit` the system halts.
 */
export const RADIUS_BANDS = {
  clean: 1,
  acceptable: 2,
  needsJustification: 5,
  limit: 100,
} as const;

/**
 * Radii the operator can choose for "Find comparables", in miles, as Lou asked
 * (12 October 2026). The first is the default. Steps past
 * RADIUS_BANDS.needsJustification (5 mi) are the extended band: a comp from
 * there is shown with a red hue as a cue and is permitted up to
 * RADIUS_BANDS.limit. Widening is a deliberate click, never automatic.
 */
export const SEARCH_RADIUS_STEPS = [5, 10, 25, 50] as const;
export type SearchRadiusMiles = (typeof SEARCH_RADIUS_STEPS)[number];
export const DEFAULT_SEARCH_RADIUS_MILES: SearchRadiusMiles = 5;

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
