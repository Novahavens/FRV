/**
 * Pure arithmetic for the stepper control, kept apart from the component so it
 * can be tested without a DOM.
 *
 * Steps snap to the grid. Pressing up from 1.75 with a 0.5 step lands on 2, and
 * pressing down lands on 1.5, so a value that was imported off a listing (Zillow
 * reports baths such as 1.75) is never stranded between two increments.
 */
export interface StepBounds {
  min: number;
  max: number;
  step: number;
}

/** Next value one step up or down, snapped to the grid and clamped to bounds. */
export function nextValue(current: number | null, direction: 1 | -1, { min, max, step }: StepBounds): number {
  if (current === null || !Number.isFinite(current)) return min;
  const ticks = direction === 1 ? Math.floor(current / step) + 1 : Math.ceil(current / step) - 1;
  return Math.min(max, Math.max(min, ticks * step));
}

/** Whole numbers print without a decimal; anything else prints as typed, to two places. */
export function formatValue(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Parses the form's string state. Blank or non-numeric input is `null`. */
export function parseValue(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
