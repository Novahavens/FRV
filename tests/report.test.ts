import { describe, expect, it } from 'vitest';
import { LEGACY_MULTIPLIER_TIERS, MULTIPLIER_TIERS, calculateFrv } from '@/lib/frv';
import type { Comp, LossProperty } from '@/lib/frv';
import { buildReportModel } from '@/lib/report/model';
import { NEUTRALITY_DECLARATION } from '@/lib/report/declarations';

const loss: LossProperty = {
  claimIdentifier: 'NH-2026-0417-A',
  address: '205 Park Meadow Way, Coppell TX 75019',
  lat: 32.9668, lng: -96.9903,
  bedrooms: 4, bathrooms: 2, sqft: 2100,
  termMonths: 3, managementFeeCents: 240_00,
  multiplierTiers: LEGACY_MULTIPLIER_TIERS,
};

const comp = (id: string, rentCents: number, sqft: number): Comp => ({
  id, url: `https://www.zillow.com/homedetails/x/${id}_zpid/`,
  address: `${id} Example St, Coppell TX 75019`,
  rentCents, bedrooms: 4, bathrooms: 2, sqft,
  furnished: false, lat: 32.9674, lng: -96.9911,
});

const model = buildReportModel(
  loss,
  calculateFrv(loss, [comp('c1', 3_835_00, 2250), comp('c2', 3_600_00, 2100), comp('c3', 3_200_00, 1900)]),
  { preparedOn: new Date('2026-04-24T12:00:00Z'), status: 'Final' },
);

describe('report model', () => {
  it('headlines the averaged FRV with both decimal places', () => {
    expect(model.headline.amount).toBe('$6,448.50');
  });

  it('prints the twelve-month figure', () => {
    expect(model.twelveMonth.at(-1)).toEqual({
      label: 'Approximate total monthly cost without furniture',
      value: '$3,785',
    });
  });

  it('ends the averaged block on the total with furniture', () => {
    expect(model.averaged.at(-1)).toEqual({
      label: 'Approximate total monthly cost with furniture',
      value: '$6,448.50',
    });
  });

  it('prints the total without furniture, as the Alacrity format does', () => {
    expect(model.averaged.at(-2)).toEqual({
      label: 'Approximate total monthly cost without furniture',
      value: '$4,848.50',
    });
  });

  it('carries the comp listing URL through to the report', () => {
    expect(model.comps[0]!.url).toContain('zillow.com');
  });

  it('keeps comps in persisted high-to-low order', () => {
    expect(model.comps.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(model.comps[0]!.rows[0]!.value).toBe('$3,835');
  });

  it('shows distance with one decimal and the unit', () => {
    expect(model.comps[0]!.distance).toMatch(/^\d+\.\d miles$/);
  });
});

describe('printed reference tables', () => {
  it('prints the schedule the calculation actually used, so the table cannot drift from the figure', () => {
    expect(model.multiplierTable).toEqual([
      { label: '1–2 months', value: '40%' },
      { label: '3–5 months', value: '30%' },
      { label: '6–9 months', value: '25%' },
      { label: '10–11 months', value: '10%' },
      { label: '12+ months', value: 'No markup' },
    ]);
  });

  it('prints the current defaults, half-points included, when a claim uses them', () => {
    const { multiplierTiers: _omit, ...plain } = loss;
    const current = buildReportModel(plain, calculateFrv(plain, [comp('c1', 3_835_00, 2250), comp('c2', 3_600_00, 2100), comp('c3', 3_200_00, 1900)]));
    expect(current.multiplierTable.map((r) => r.value)).toEqual(['50%', '37.5%', '31.25%', '12.5%', 'No markup']);
    expect(current.multiplierTable).toHaveLength(MULTIPLIER_TIERS.length);
  });

  it('prints every furniture rate', () => {
    expect(model.furnitureTable).toEqual([
      { label: '1 bedroom', value: '$1,059' },
      { label: '2 bedrooms', value: '$1,267' },
      { label: '3 bedrooms', value: '$1,456' },
      { label: '4 bedrooms', value: '$1,600' },
      { label: '5 bedrooms', value: '$1,746' },
    ]);
  });
});

describe('declarations', () => {
  it('reproduces the neutrality declaration verbatim', () => {
    expect(model.notes.neutrality).toBe(NEUTRALITY_DECLARATION);
    expect(model.notes.neutrality).toContain(
      'Nova Havens does not receive any monetary or financial benefit',
    );
    expect(model.notes.neutrality).toContain(
      'no direct, indirect, present, or anticipated future interest',
    );
  });

  it('falls back to an illustration when there is no loss photo', () => {
    expect(model.loss.photoUrl).toBeNull();
  });
});
