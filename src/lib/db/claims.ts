import { db } from './client';
import {
  calculateFrv,
  type Calculation,
  type Comp,
  type EvaluatedComp,
  type LossProperty,
} from '@/lib/frv';

export class ClaimNotFoundError extends Error {
  constructor(id: string) {
    super(`No claim found for ${id}.`);
    this.name = 'ClaimNotFoundError';
  }
}

export class NotLockedError extends Error {
  constructor(id: string) {
    super(`Claim ${id} has no locked calculation yet. Submit the FRV first.`);
    this.name = 'NotLockedError';
  }
}

export interface StoredClaim {
  id: string;
  loss: LossProperty;
  calculation: Calculation;
  status: 'draft' | 'locked';
  version: number;
  photoUrl: string | null;
  /** Set when any comp's figures came from a source that requires attribution. */
  attribution: string | null;
}

export const ZILLOW_ATTRIBUTION = 'Comparable data provided by Zillow, Inc. (https://www.zillow.com/)';

/** Row shapes, kept beside the queries that read them. */
interface ClaimRow {
  id: string; claim_identifier: string; address: string;
  lat: number; lng: number; bedrooms: number; bathrooms: number; sqft: number;
  term_months: number; mgmt_fee_cents: number; status: 'draft' | 'locked';
  photo_url: string | null;
}
interface CompRow {
  id: string; url: string; address: string; rent_cents: number;
  bedrooms: number; bathrooms: number; sqft: number; furnished: boolean;
  lat: number; lng: number; distance_mi: number; sort_position: number;
  overridden_fields: string[]; listing_source: 'manual' | 'firecrawl-zillow';
}
interface CalcRow {
  version: number; multiplier: number; furniture_cents: number; mgmt_fee_cents: number;
  per_comp_frv_cents: number[]; averaged_base_rent_cents: number;
  averaged_frv_cents: number; frv_12mo_cents: number;
}

const toLoss = (row: ClaimRow): LossProperty => ({
  claimIdentifier: row.claim_identifier,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
  bedrooms: row.bedrooms,
  bathrooms: Number(row.bathrooms),
  sqft: row.sqft,
  termMonths: row.term_months,
  managementFeeCents: row.mgmt_fee_cents,
});

const toComp = (row: CompRow): Comp => ({
  id: row.id,
  url: row.url,
  address: row.address,
  rentCents: row.rent_cents,
  bedrooms: row.bedrooms,
  bathrooms: Number(row.bathrooms),
  sqft: row.sqft,
  furnished: row.furnished,
  lat: row.lat,
  lng: row.lng,
  overriddenFields: row.overridden_fields,
  source: row.listing_source,
});

/**
 * Read a locked claim and rebuild its calculation FROM STORED FIGURES.
 *
 * This is the part that makes a locked report permanent. Recalculating here
 * would mean a later change to the engine silently restates a report an adjuster
 * has already accepted — the figures below come out of the `calculations` row
 * and the engine is not consulted at all.
 */
export async function loadLockedClaim(claimId: string): Promise<StoredClaim> {
  const supabase = db();

  const [{ data: claim }, { data: comps }, { data: calc }] = await Promise.all([
    supabase.from('claims').select('*').eq('id', claimId).maybeSingle<ClaimRow>(),
    supabase.from('comps').select('*').eq('claim_id', claimId).order('sort_position').returns<CompRow[]>(),
    supabase.from('calculations').select('*').eq('claim_id', claimId)
      .order('version', { ascending: false }).limit(1).maybeSingle<CalcRow>(),
  ]);

  if (!claim) throw new ClaimNotFoundError(claimId);
  if (!calc || !comps?.length) throw new NotLockedError(claimId);

  const evaluated: EvaluatedComp[] = comps.map((row, i) => {
    const base = toComp(row);
    const frvCents = calc.per_comp_frv_cents[i] ?? 0;
    return {
      ...base,
      sortPosition: row.sort_position,
      distanceMiles: Number(row.distance_mi),
      // Back out the adjusted rent from the stored total rather than
      // re-multiplying: the stored figure is the one on the adjuster's copy.
      adjustedRentCents: frvCents - calc.furniture_cents - calc.mgmt_fee_cents,
      frvCents,
    };
  });

  const averagedAdjustedRentCents = Math.round(
    evaluated.reduce((sum, c) => sum + c.adjustedRentCents, 0) / evaluated.length,
  );

  return {
    id: claim.id,
    status: claim.status,
    version: calc.version,
    photoUrl: claim.photo_url,
    attribution: comps.some((c) => c.listing_source === 'firecrawl-zillow') ? ZILLOW_ATTRIBUTION : null,
    loss: toLoss(claim),
    calculation: {
      multiplier: Number(calc.multiplier),
      furnitureCents: calc.furniture_cents,
      managementFeeCents: calc.mgmt_fee_cents,
      comps: evaluated,
      averagedBaseRentCents: calc.averaged_base_rent_cents,
      averagedAdjustedRentCents,
      averagedFrvCents: calc.averaged_frv_cents,
      twelveMonthCents: calc.frv_12mo_cents,
    },
  };
}

/**
 * Persist a calculation and lock the claim, in that order.
 *
 * Every intermediate figure is written down. Nothing is recalculated at render
 * time, so a later change to the engine cannot restate an accepted report.
 */
export async function submitAndLock(
  claimId: string,
  loss: LossProperty,
  comps: Comp[],
  actor: string,
): Promise<Calculation> {
  const calculation = calculateFrv(loss, comps);
  const supabase = db();

  const { data: existing } = await supabase
    .from('calculations').select('version').eq('claim_id', claimId)
    .order('version', { ascending: false }).limit(1).maybeSingle<{ version: number }>();

  const version = (existing?.version ?? 0) + 1;

  const { error: calcError } = await supabase.from('calculations').insert({
    claim_id: claimId,
    version,
    multiplier: calculation.multiplier,
    furniture_cents: calculation.furnitureCents,
    mgmt_fee_cents: calculation.managementFeeCents,
    per_comp_frv_cents: calculation.comps.map((c) => c.frvCents),
    averaged_base_rent_cents: calculation.averagedBaseRentCents,
    averaged_frv_cents: calculation.averagedFrvCents,
    frv_12mo_cents: calculation.twelveMonthCents,
  });
  if (calcError) throw new Error(`Could not store the calculation: ${calcError.message}`);

  // Rule 2 and Rule 5 in one transition: the number is fixed, and only now does
  // sourcing open.
  const { error: lockError } = await supabase
    .from('claims')
    .update({ status: 'locked', locked_at: new Date().toISOString(), sourcing_unlocked: true })
    .eq('id', claimId);
  if (lockError) throw new Error(`Could not lock the claim: ${lockError.message}`);

  await supabase.from('validation_events').insert({
    claim_id: claimId,
    rule: 'rule-5-lock',
    outcome: 'pass',
    detail: `Locked at version ${version}.`,
    actor_id: actor,
  });

  return calculation;
}

/** The only sanctioned route through the lock. See open_revision() in the migration. */
export async function openRevision(
  claimId: string,
  reason: 'sqft_differed' | 'market_shifted' | 'comp_was_wrong' | 'term_changed',
  actor: string,
  note?: string,
): Promise<number> {
  const { data, error } = await db().rpc('open_revision', {
    p_claim_id: claimId,
    p_reason: reason,
    p_actor: actor,
    p_note: note ?? null,
  });
  if (error) throw new Error(`Could not open a revision: ${error.message}`);
  return data as number;
}
