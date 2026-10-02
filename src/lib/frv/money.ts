import type { Cents } from './types';

/** Parse "$3,835", "3835.50", 3835 → cents. Returns null on anything ambiguous. */
export function parseMoneyToCents(input: string | number | null | undefined): Cents | null {
  if (input == null || input === '') return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/**
 * Multiply cents by a decimal multiplier, rounding half away from zero.
 *
 * Banker's rounding would be defensible statistically and indefensible to an
 * adjuster, who will check the arithmetic on a calculator. Match what a person
 * gets by hand.
 */
export function applyMultiplier(cents: Cents, multiplier: number): Cents {
  const exact = cents * multiplier;
  return Math.sign(exact) * Math.round(Math.abs(exact));
}

/**
 * Mean of a list of cent values.
 *
 * The remainder is distributed rather than dropped, so the average of the three
 * per-comp figures always reconciles against their sum. Coppell averages
 * $3,835 / $3,600 / $3,200 to exactly $3,545 — no trailing cent appears from
 * nowhere on the report.
 */
export function averageCents(values: readonly Cents[]): Cents {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return Math.round(total / values.length);
}

const USD_WHOLE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_EXACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "$10,145" / "$6,448.50". Never abbreviated — see the brand book.
 *
 * Whole amounts drop the decimals; fractional ones always show both places.
 * A single trailing digit ("$6,448.5") reads as a typo on a document going to
 * a carrier, which is the one audience allowed to doubt the arithmetic.
 */
export function formatCents(cents: Cents): string {
  const dollars = cents / 100;
  return cents % 100 === 0 ? USD_WHOLE.format(dollars) : USD_EXACT.format(dollars);
}
