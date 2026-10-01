/**
 * Domain types for the Fair Rental Value calculation.
 *
 * Money is represented in whole cents as an integer everywhere inside the
 * engine. Floating-point dollars accumulate error across a multiply-then-average
 * chain, and this number is the ceiling on someone's housing for months — it
 * has to reproduce exactly from stored data, forever. Dollars exist only at the
 * edges, in parsing and formatting.
 */
export type Cents = number;

export type LeaseTermMonths = number;

/** The four validation outcomes, in the design system's own language. */
export type Tone = 'pass' | 'warn' | 'block' | 'info';

/** Rules as enforced by the system, numbered as in PRD section 5. */
export type RuleId =
  | 'rule-1-unfurnished'
  | 'rule-3-sort-order'
  | 'rule-4-geography'
  | 'bedroom-match'
  | 'sqft-tolerance'
  | 'market-boundary'
  | 'comp-variance';

export interface LossProperty {
  claimIdentifier: string;
  address: string;
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  termMonths: LeaseTermMonths;
  /** Default 240_00. Zero is permitted — standard non-ASAP sourcing carries no fee. */
  managementFeeCents: Cents;
}

export interface Comp {
  id: string;
  url: string;
  address: string;
  rentCents: Cents;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  furnished: boolean;
  lat: number;
  lng: number;
  /** Which fields a human corrected over the API's answer. Audit, not decoration. */
  overriddenFields?: string[];
  /** Where the figures came from. Drives the attribution line on the report. */
  source?: 'manual' | 'firecrawl-zillow';
}

/** A comp with everything the system derived about it. */
export interface EvaluatedComp extends Comp {
  distanceMiles: number;
  sortPosition: number;
  frvCents: Cents;
  adjustedRentCents: Cents;
}

export interface ValidationEvent {
  rule: RuleId;
  tone: Tone;
  /** Which comp this concerns, when it concerns one. */
  compId?: string;
  message: string;
  detail?: string;
  /** True when no action by any user can clear this. */
  terminal?: boolean;
}

export interface Calculation {
  multiplier: number;
  furnitureCents: Cents;
  managementFeeCents: Cents;
  comps: EvaluatedComp[];
  averagedBaseRentCents: Cents;
  averagedAdjustedRentCents: Cents;
  /** THE number. */
  averagedFrvCents: Cents;
  /** Averaged base rent + management fee. No multiplier, no furniture. */
  twelveMonthCents: Cents;
}

export interface ValidationResult {
  events: ValidationEvent[];
  /** No calculation output exists for a claim that has not passed. */
  passed: boolean;
  /** Warnings the operator must acknowledge in writing before submitting. */
  requiresJustification: ValidationEvent[];
}
