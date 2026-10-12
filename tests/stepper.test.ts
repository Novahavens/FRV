import { describe, expect, it } from 'vitest';
import { formatValue, nextValue, parseValue } from '@/components/ui/stepper-math';

const whole = { min: 1, max: 5, step: 1 };
const halves = { min: 0.5, max: 10, step: 0.5 };

describe('nextValue — whole steps (bedrooms)', () => {
  it('moves one bedroom at a time', () => {
    expect(nextValue(2, 1, whole)).toBe(3);
    expect(nextValue(2, -1, whole)).toBe(1);
  });
  it('clamps at the bounds rather than overflowing', () => {
    expect(nextValue(5, 1, whole)).toBe(5);
    expect(nextValue(1, -1, whole)).toBe(1);
  });
});

describe('nextValue — half steps (bathrooms)', () => {
  it('moves by half a bathroom', () => {
    expect(nextValue(2, 1, halves)).toBe(2.5);
    expect(nextValue(2, -1, halves)).toBe(1.5);
    expect(nextValue(2.5, 1, halves)).toBe(3);
    expect(nextValue(2.5, -1, halves)).toBe(2);
  });
  it('snaps an off-grid value from a listing onto the grid', () => {
    expect(nextValue(1.75, 1, halves)).toBe(2);
    expect(nextValue(1.75, -1, halves)).toBe(1.5);
  });
  it('stops at the half-bathroom floor and the ten-bathroom ceiling', () => {
    expect(nextValue(0.5, -1, halves)).toBe(0.5);
    expect(nextValue(10, 1, halves)).toBe(10);
  });
});

describe('nextValue — unset value', () => {
  it('starts at the minimum in either direction', () => {
    expect(nextValue(null, 1, whole)).toBe(1);
    expect(nextValue(null, -1, halves)).toBe(0.5);
  });
});

describe('formatValue and parseValue', () => {
  it('prints whole numbers without a decimal and halves with one', () => {
    expect(formatValue(4)).toBe('4');
    expect(formatValue(2.5)).toBe('2.5');
    expect(formatValue(1.75)).toBe('1.75');
  });
  it('reads blank as unset and numbers as numbers', () => {
    expect(parseValue('')).toBeNull();
    expect(parseValue('   ')).toBeNull();
    expect(parseValue('2.5')).toBe(2.5);
    expect(parseValue('abc')).toBeNull();
  });
});
