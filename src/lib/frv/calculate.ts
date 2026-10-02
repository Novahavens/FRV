import { distanceMiles } from './geo';
import { applyMultiplier, averageCents } from './money';
import { furnitureForBedrooms, multiplierForTerm } from './multiplier';
import type { Calculation, Comp, EvaluatedComp, LossProperty, ValidationEvent } from './types';
import { validate } from './validate';

/**
 * Sort comps by rent, descending.
 *
 * Selection is high-to-low because the FRV is a ceiling and a higher defensible
 * ceiling gives the account manager room to place someone. Output is the average
 * of the three, which is more defensible to a carrier than a single
 * top-of-market listing. Those are two separate decisions and this function is
 * only the first one.
 *
 * The result is persisted with its sort_position rather than recomputed at
 * render, so a later rent correction cannot silently reorder a locked report.
 */
export function sortHighToLow(comps: readonly Comp[]): Comp[] {
  return [...comps].sort((a, b) => b.rentCents - a.rentCents);
}

export class ValidationFailedError extends Error {
  /** The blocking events, so the caller can render them without re-validating. */
  readonly blocking: ValidationEvent[];

  constructor(blocking: ValidationEvent[]) {
    super('Cannot calculate an FRV until every blocking rule is cleared.');
    this.name = 'ValidationFailedError';
    this.blocking = blocking;
  }
}

/**
 * The FRV.
 *
 *   per comp:  (base rent × multiplier) + furniture + management fee
 *   output:    the mean of the three
 *
 * Deterministic by requirement — no model sits anywhere in this path, and the
 * same inputs always produce the same report. Every intermediate figure is
 * returned so the caller can persist it; nothing is recalculated at render time.
 *
 * @throws ValidationFailedError when any rule blocks. A number with a caveat
 *         attached is worse than no number, because only one of them stops
 *         someone sourcing against it.
 */
export function calculateFrv(loss: LossProperty, rawComps: readonly Comp[]): Calculation {
  const result = validate(loss, rawComps);
  if (!result.passed) {
    throw new ValidationFailedError(result.events.filter((e) => e.tone === 'block'));
  }

  const multiplier = multiplierForTerm(loss.termMonths);
  const furnitureCents = furnitureForBedrooms(loss.bedrooms);
  const { managementFeeCents } = loss;

  const comps: EvaluatedComp[] = sortHighToLow(rawComps).map((comp, index) => {
    const adjustedRentCents = applyMultiplier(comp.rentCents, multiplier);
    return {
      ...comp,
      sortPosition: index,
      distanceMiles: distanceMiles(loss, comp),
      adjustedRentCents,
      frvCents: adjustedRentCents + furnitureCents + managementFeeCents,
    };
  });

  const averagedBaseRentCents = averageCents(comps.map((c) => c.rentCents));
  const averagedAdjustedRentCents = averageCents(comps.map((c) => c.adjustedRentCents));
  const averagedFrvCents = averageCents(comps.map((c) => c.frvCents));

  return {
    multiplier,
    furnitureCents,
    managementFeeCents,
    comps,
    averagedBaseRentCents,
    averagedAdjustedRentCents,
    averagedFrvCents,
    // The parallel long-term figure: a standard unfurnished 12-month placement.
    // No multiplier, no furniture — it is a reference point, not a rival answer.
    twelveMonthCents: averagedBaseRentCents + managementFeeCents,
  };
}
