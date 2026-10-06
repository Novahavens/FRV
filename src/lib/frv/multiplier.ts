import { MULTIPLIER_TIERS, FURNITURE_BY_BEDROOM } from './constants';
import type { Cents, LeaseTermMonths, MultiplierTier } from './types';

/**
 * The multiplier for an approved term under a given schedule.
 *
 * Tiers are scanned in order, so boundary months land where the schedule puts
 * them. Defaults to the schedule in `constants.ts`; a claim may carry its own,
 * in which case that one is used and stored with the calculation.
 */
export function multiplierForTerm(
  termMonths: LeaseTermMonths,
  tiers: readonly MultiplierTier[] = MULTIPLIER_TIERS,
): number {
  if (!Number.isFinite(termMonths) || termMonths < 1) {
    throw new RangeError(`Approved term must be at least one month, got ${termMonths}`);
  }
  const tier = tiers.find((t) => termMonths <= t.maxMonths);
  // The final tier is unbounded, so this is unreachable — but a silent 1.0
  // would under-budget a claim, and that is worth throwing over.
  if (!tier) throw new RangeError(`No multiplier tier matched term ${termMonths}`);
  return tier.multiplier;
}

/**
 * Check a schedule an operator entered.
 *
 * Boundaries must ascend, the last tier must be open-ended, and no multiplier
 * may be below 1.0 — a markdown is not a short-term premium. Returns the
 * schedule unchanged on success so callers can use it in an expression.
 */
export function assertValidTiers(tiers: readonly MultiplierTier[]): readonly MultiplierTier[] {
  if (tiers.length === 0) throw new RangeError('A multiplier schedule needs at least one tier.');
  let previous = 0;
  tiers.forEach((tier, i) => {
    const last = i === tiers.length - 1;
    if (!Number.isFinite(tier.multiplier) || tier.multiplier < 1 || tier.multiplier > 5) {
      throw new RangeError(`Tier ${i + 1}: multiplier must be between 1.00 and 5.00, got ${tier.multiplier}.`);
    }
    if (last) {
      if (tier.maxMonths !== Infinity) throw new RangeError('The last tier must be open-ended.');
      return;
    }
    if (!Number.isInteger(tier.maxMonths) || tier.maxMonths <= previous) {
      throw new RangeError(`Tier ${i + 1}: month boundaries must be whole numbers in ascending order.`);
    }
    previous = tier.maxMonths;
  });
  return tiers;
}

/** JSON cannot carry Infinity; the open-ended tier is stored with maxMonths null. */
export type StoredTier = { maxMonths: number | null; multiplier: number };

export function tiersToStored(tiers: readonly MultiplierTier[]): StoredTier[] {
  return tiers.map((t) => ({ maxMonths: Number.isFinite(t.maxMonths) ? t.maxMonths : null, multiplier: t.multiplier }));
}

export function tiersFromStored(stored: readonly StoredTier[]): MultiplierTier[] {
  return assertValidTiers(
    stored.map((t) => ({ maxMonths: t.maxMonths == null ? Infinity : t.maxMonths, multiplier: t.multiplier })),
  ) as MultiplierTier[];
}

/** "1 month", "4–11 months" … "12+ months", for forms and the report's guideline table. */
export function tierLabel(tiers: readonly MultiplierTier[], index: number): string {
  const tier = tiers[index]!;
  const lower = index === 0 ? 1 : tiers[index - 1]!.maxMonths + 1;
  if (!Number.isFinite(tier.maxMonths)) return `${lower}+ months`;
  if (lower === tier.maxMonths) return `${lower} ${lower === 1 ? 'month' : 'months'}`;
  return `${lower}–${tier.maxMonths} months`;
}

/** 1.375 → "37.5%" (legacy-derived values), 1 → "No markup". Never rounds away a half-point. */
export function markupLabel(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 10_000) / 100;
  return pct === 0 ? 'No markup' : `${pct}%`;
}

/**
 * Furniture for the LOSS property's bedroom count — never the comp's.
 * The insured is being furnished for the home they lost.
 */
export function furnitureForBedrooms(bedrooms: number): Cents {
  const cents = FURNITURE_BY_BEDROOM[bedrooms];
  if (cents == null) {
    const known = Object.keys(FURNITURE_BY_BEDROOM).join(', ');
    throw new RangeError(
      `No furniture rate for ${bedrooms} bedrooms. Rates exist for ${known}.`,
    );
  }
  return cents;
}
