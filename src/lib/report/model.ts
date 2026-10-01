import {
  FURNITURE_BY_BEDROOM,
  MULTIPLIER_TIERS,
  formatCents,
  formatMiles,
} from '@/lib/frv';
import type { Calculation, Cents, LossProperty } from '@/lib/frv';
import {
  AVAILABILITY_NOTE,
  EVALUATION_NOTE,
  FURNITURE_DISCLAIMER,
  NEUTRALITY_DECLARATION,
} from './declarations';

/**
 * The report, structured the way an adjuster already reads one.
 *
 * Section anatomy follows the Alacrity format carriers receive today — Loss
 * Address Details, FRV Address Details, 12-month FRV Details, then the
 * guideline tables and the neutrality declaration. An adjuster should be able
 * to find a number in the same place they always have.
 *
 * What differs is Nova Havens' methodology underneath: Alacrity's report carries
 * a single comp, ours carries three and averages them, so "FRV Address Details"
 * becomes a per-comp set plus an averaged block. The labels are theirs; the
 * arithmetic is ours.
 *
 * This is the only place either renderer gets content from. react-pdf cannot
 * share JSX with the DOM, so the shared layer is the data: everything arrives
 * pre-formatted, because formatting in two renderers is how "$6,448.50" becomes
 * "$6,448.5" on one of them.
 */
export interface ReportRow {
  label: string;
  value: string;
}

/** One comp, in Alacrity's "FRV Address Details" shape. */
export interface ReportCompDetail {
  position: number;
  address: string;
  url: string;
  propertyType: string;
  size: string;
  squareFootage: string;
  distance: string;
  rows: ReportRow[];
}

export interface ReportModel {
  claimIdentifier: string;
  preparedOn: string;
  status: 'Draft' | 'Final';
  version: number;

  loss: {
    address: string;
    size: string;
    squareFootage: string;
    minimumLeaseTerm: string;
    photoUrl: string | null;
  };

  headline: {
    amount: string;
    caption: string;
  };

  /** The averaged figures — Nova Havens' addition to the Alacrity layout. */
  averaged: ReportRow[];

  comps: ReportCompDetail[];

  twelveMonth: ReportRow[];

  multiplierTable: ReportRow[];
  furnitureTable: ReportRow[];

  compliance: Array<{ label: string; detail: string }>;

  notes: {
    evaluation: string;
    availability: string;
    neutrality: string;
    furnitureDisclaimer: string;
    /** Printed when any comp's figures came from a source that requires it. */
    attribution: string | null;
  };
}

const DATE = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const bedsAndBaths = (beds: number, baths: number) =>
  `${beds} bedrooms and ${baths} bathrooms`;

export function buildReportModel(
  loss: LossProperty,
  calculation: Calculation,
  options: {
    preparedOn?: Date;
    status?: 'Draft' | 'Final';
    version?: number;
    photoUrl?: string | null;
    attribution?: string | null;
  } = {},
): ReportModel {
  const { comps, multiplier, furnitureCents, managementFeeCents } = calculation;
  const termLabel = `${loss.termMonths} ${loss.termMonths === 1 ? 'month' : 'months'}`;

  /** Alacrity prints both totals. Without furniture is adjusted rent + fee. */
  const withoutFurniture = (adjusted: Cents) => adjusted + managementFeeCents;

  return {
    claimIdentifier: loss.claimIdentifier,
    preparedOn: DATE.format(options.preparedOn ?? new Date()),
    status: options.status ?? 'Draft',
    version: options.version ?? 1,

    loss: {
      address: loss.address,
      size: bedsAndBaths(loss.bedrooms, loss.bathrooms),
      squareFootage: loss.sqft.toLocaleString(),
      minimumLeaseTerm: termLabel,
      photoUrl: options.photoUrl ?? null,
    },

    headline: {
      amount: formatCents(calculation.averagedFrvCents),
      caption: `Approximate total monthly cost with furniture · ${termLabel} minimum lease term`,
    },

    averaged: [
      { label: 'Approximate rent for the property', value: formatCents(calculation.averagedBaseRentCents) },
      { label: `Short-term multiplier, ${termLabel}`, value: `× ${multiplier.toFixed(2)}` },
      { label: 'Adjusted rent', value: formatCents(calculation.averagedAdjustedRentCents) },
      { label: 'Approximate furniture/housewares/appliances price', value: formatCents(furnitureCents) },
      { label: 'Monthly management fee', value: formatCents(managementFeeCents) },
      {
        label: 'Approximate total monthly cost without furniture',
        value: formatCents(withoutFurniture(calculation.averagedAdjustedRentCents)),
      },
      {
        label: 'Approximate total monthly cost with furniture',
        value: formatCents(calculation.averagedFrvCents),
      },
    ],

    comps: comps.map((comp) => ({
      position: comp.sortPosition + 1,
      address: comp.address,
      url: comp.url,
      propertyType: 'Single Family Home',
      size: bedsAndBaths(comp.bedrooms, comp.bathrooms),
      squareFootage: comp.sqft.toLocaleString(),
      distance: formatMiles(comp.distanceMiles),
      rows: [
        { label: 'Approximate rent for the property', value: formatCents(comp.rentCents) },
        { label: 'Adjusted rent', value: formatCents(comp.adjustedRentCents) },
        {
          label: 'Total monthly cost without furniture',
          value: formatCents(withoutFurniture(comp.adjustedRentCents)),
        },
        { label: 'Total monthly cost with furniture', value: formatCents(comp.frvCents) },
      ],
    })),

    twelveMonth: [
      { label: 'Approximate rent for the property', value: formatCents(calculation.averagedBaseRentCents) },
      { label: 'Monthly management fee', value: formatCents(managementFeeCents) },
      {
        label: 'Approximate total monthly cost without furniture',
        value: formatCents(calculation.twelveMonthCents),
      },
    ],

    // Derived from the engine's own constants, so the guideline tables an
    // adjuster checks can never disagree with the arithmetic above them.
    multiplierTable: MULTIPLIER_TIERS.map((tier, i) => {
      const lower = i === 0 ? 1 : (MULTIPLIER_TIERS[i - 1]!.maxMonths as number) + 1;
      const label = Number.isFinite(tier.maxMonths)
        ? `${lower}–${tier.maxMonths} months`
        : `${lower}+ months`;
      const markup = Math.round((tier.multiplier - 1) * 100);
      return { label, value: markup === 0 ? 'No markup' : `${markup}%` };
    }),

    furnitureTable: Object.entries(FURNITURE_BY_BEDROOM).map(([beds, cents]) => ({
      label: `${beds} ${beds === '1' ? 'bedroom' : 'bedrooms'}`,
      value: formatCents(cents),
    })),

    compliance: [
      { label: 'Unfurnished comparables only', detail: 'All three listings verified unfurnished.' },
      {
        label: 'Within radius tolerance',
        detail: `Furthest comparable ${formatMiles(Math.max(...comps.map((c) => c.distanceMiles)))}.`,
      },
      { label: 'Sorted high to low', detail: 'Ordering persisted with the record.' },
      { label: 'Calculated before sourcing', detail: 'No housing search opened until this figure locked.' },
    ],

    notes: {
      evaluation: EVALUATION_NOTE,
      availability: AVAILABILITY_NOTE,
      neutrality: NEUTRALITY_DECLARATION,
      furnitureDisclaimer: FURNITURE_DISCLAIMER,
      attribution: options.attribution ?? null,
    },
  };
}
