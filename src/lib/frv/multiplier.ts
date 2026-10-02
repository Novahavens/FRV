import { MULTIPLIER_TIERS, FURNITURE_BY_BEDROOM } from './constants';
import type { Cents, LeaseTermMonths } from './types';

/**
 * The multiplier for an approved term.
 *
 * Tiers are scanned in order, so the boundary months land where the reference
 * guide puts them: 2 → 1.40, 3 → 1.30, 9 → 1.25, 12 → 1.00. The blank Drive
 * template lists the 6–9 tier at 24%; that template is wrong and is being
 * corrected at source. 25% is the figure on record.
 */
export function multiplierForTerm(termMonths: LeaseTermMonths): number {
  if (!Number.isFinite(termMonths) || termMonths < 1) {
    throw new RangeError(`Approved term must be at least one month, got ${termMonths}`);
  }
  const tier = MULTIPLIER_TIERS.find((t) => termMonths <= t.maxMonths);
  // The final tier is unbounded, so this is unreachable — but a silent 1.0
  // would under-budget a claim, and that is worth throwing over.
  if (!tier) throw new RangeError(`No multiplier tier matched term ${termMonths}`);
  return tier.multiplier;
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
