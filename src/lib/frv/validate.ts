import { FURNISHED_KEYWORDS, REQUIRED_COMP_COUNT, SQFT_TOLERANCE } from './constants';
import { classifyDistance, distanceMiles, formatMiles } from './geo';
import { formatCents } from './money';
import type { Comp, LossProperty, ValidationEvent, ValidationResult } from './types';

/**
 * Rule 1 — unfurnished comps only.
 *
 * Checked against the structured furnished flag first, then listing text. A
 * furnished rent already contains the furniture cost and the formula adds
 * furniture again in the next step, so accepting one double-counts it. There is
 * no override path, at any permission level.
 */
export function checkUnfurnished(comp: Comp, listingText = ''): ValidationEvent | null {
  const haystack = `${comp.address} ${comp.url} ${listingText}`.toLowerCase();
  const hit = FURNISHED_KEYWORDS.find((kw) => haystack.includes(kw));

  if (!comp.furnished && !hit) return null;

  return {
    rule: 'rule-1-unfurnished',
    tone: 'block',
    compId: comp.id,
    terminal: true,
    message: comp.furnished
      ? 'This listing is marked furnished.'
      : `This listing reads as furnished — it mentions "${hit}".`,
    detail:
      'A furnished rent already includes the furniture cost, and the formula adds it ' +
      'again. Replace this comp with an unfurnished listing. This cannot be overridden.',
  };
}

/**
 * Rule 4 — geography. Under two miles passes silently; two to five needs a
 * written justification; five to one hundred is permitted and noted on the
 * record (October 2026); past one hundred the calculation halts.
 */
export function checkGeography(comp: Comp, loss: LossProperty): ValidationEvent | null {
  const miles = distanceMiles(loss, comp);
  const { band, tone } = classifyDistance(miles);

  if (band === 'clean' || band === 'acceptable') return null;

  if (band === 'needs-justification') {
    return {
      rule: 'rule-4-geography',
      tone,
      compId: comp.id,
      message: `This comp is ${formatMiles(miles)} from the loss address.`,
      detail:
        'Between two and five miles needs a written justification before you can submit.',
    };
  }

  if (band === 'extended') {
    return {
      rule: 'rule-4-geography',
      tone,
      compId: comp.id,
      message: `This comp is ${formatMiles(miles)} from the loss address.`,
      detail:
        'Past five miles is permitted up to one hundred. No justification is required; ' +
        'the distance is printed on the report.',
    };
  }

  return {
    rule: 'rule-4-geography',
    tone: 'block',
    compId: comp.id,
    terminal: true,
    message: `This comp is ${formatMiles(miles)} from the loss address.`,
    detail:
      'Past one hundred miles the calculation stops rather than widening. Choose a ' +
      'closer comp, or flag the claim for manual review.',
  };
}

/**
 * Bedroom match is enforced. Bathroom match deliberately is not.
 *
 * A 4-bed/2.5-bath comp was correctly used for a 3-bed/3-bath loss because
 * square footage and location mattered more. Filtering on bathrooms narrows the
 * pool without improving the comp. Do not "fix" this.
 */
export function checkBedrooms(comp: Comp, loss: LossProperty): ValidationEvent | null {
  if (comp.bedrooms === loss.bedrooms) return null;
  return {
    rule: 'bedroom-match',
    tone: 'warn',
    compId: comp.id,
    message: `This comp has ${comp.bedrooms} bedrooms; the loss property has ${loss.bedrooms}.`,
    detail:
      'Bedroom count drives the furniture figure, which is taken from the loss ' +
      'property either way. Acknowledge this if the comp is right on size and location.',
  };
}

/** Square footage within ±15% of the loss property. */
export function checkSquareFootage(comp: Comp, loss: LossProperty): ValidationEvent | null {
  const delta = Math.abs(comp.sqft - loss.sqft) / loss.sqft;
  if (delta <= SQFT_TOLERANCE) return null;

  const pct = Math.round(delta * 100);
  return {
    rule: 'sqft-tolerance',
    tone: 'warn',
    compId: comp.id,
    message: `This comp is ${pct}% off the loss property on square footage.`,
    detail: `${comp.sqft.toLocaleString()} sq ft against ${loss.sqft.toLocaleString()} sq ft. The tolerance is 15%.`,
  };
}

/**
 * Wide variance across the three comps.
 *
 * Elacrity's tool forces a manual redo past roughly $1,500 of spread. Three
 * comps spread that far are not describing one market, and averaging them gives
 * a number that is defensible on paper and wrong in practice. A warning, not a
 * block — the operator may have a reason.
 */
export function checkVariance(comps: readonly Comp[], thresholdCents = 1_500_00): ValidationEvent | null {
  if (comps.length < 2) return null;
  const rents = comps.map((c) => c.rentCents);
  const spread = Math.max(...rents) - Math.min(...rents);
  if (spread <= thresholdCents) return null;

  return {
    rule: 'comp-variance',
    tone: 'warn',
    message: `The three comps span ${formatCents(spread)}.`,
    detail:
      'That is a wide spread for one sub-market. Check the comps sit on the same side ' +
      'of any major boundary before averaging them.',
  };
}

/**
 * Run every rule. Nothing downstream may produce a number unless this passes.
 *
 * Ordering matters for the operator: blocking failures first, because those are
 * the only ones that require action before anything else is worth reading.
 */
export function validate(
  loss: LossProperty,
  comps: readonly Comp[],
  listingText: Readonly<Record<string, string>> = {},
): ValidationResult {
  const events: ValidationEvent[] = [];

  if (comps.length !== REQUIRED_COMP_COUNT) {
    events.push({
      rule: 'rule-3-sort-order',
      tone: 'block',
      message: `An FRV needs exactly ${REQUIRED_COMP_COUNT} comps; this claim has ${comps.length}.`,
      detail: 'Selection takes the top three defensible matches; output averages those three.',
    });
  }

  for (const comp of comps) {
    const checks = [
      checkUnfurnished(comp, listingText[comp.id] ?? ''),
      checkGeography(comp, loss),
      checkBedrooms(comp, loss),
      checkSquareFootage(comp, loss),
    ];
    for (const event of checks) if (event) events.push(event);
  }

  const variance = checkVariance(comps);
  if (variance) events.push(variance);

  events.sort((a, b) => toneWeight(a.tone) - toneWeight(b.tone));

  return {
    events,
    passed: !events.some((e) => e.tone === 'block'),
    requiresJustification: events.filter((e) => e.tone === 'warn'),
  };
}

const TONE_ORDER = { block: 0, warn: 1, info: 2, pass: 3 } as const;
const toneWeight = (tone: ValidationEvent['tone']) => TONE_ORDER[tone];
