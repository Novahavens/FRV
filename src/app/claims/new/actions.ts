'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { SEARCH_RADIUS_STEPS, calculateFrv, tiersFromStored, tiersToStored, type Comp, type LossProperty } from '@/lib/frv';
import { db } from '@/lib/db/client';
import { isConfigured } from '@/lib/env';

/**
 * Create a claim, store its comps, calculate, and lock — one transaction's
 * worth of intent, even though Supabase makes us do it in steps.
 *
 * The calculation runs again here on the server. The browser already computed
 * the same figure for the live preview, but a number that reaches an adjuster
 * must never have been computed on a machine we do not control.
 */
const compSchema = z.object({
  url: z.string().url('Paste the listing URL.'),
  address: z.string().min(3, 'Address is required.'),
  rentCents: z.number().int().positive(),
  bedrooms: z.number().int().min(1).max(10),
  bathrooms: z.number().min(0.5).max(10),
  sqft: z.number().int().positive(),
  furnished: z.boolean(),
  lat: z.number(),
  lng: z.number(),
  source: z.enum(['manual', 'firecrawl-zillow']).default('manual'),
});

const payloadSchema = z.object({
  claimIdentifier: z.string().min(1, 'Claim identifier is required.'),
  address: z.string().min(3, 'Loss address is required.'),
  lat: z.number(),
  lng: z.number(),
  bedrooms: z.number().int().min(1).max(5),
  bathrooms: z.number().min(0.5).max(10),
  sqft: z.number().int().positive(),
  termMonths: z.number().int().min(1).max(60),
  managementFeeCents: z.number().int().min(0),
  preparedBy: z.string().min(2, 'Your name goes on the audit trail.'),
  justification: z.string().optional(),
  /** The multiplier schedule, if the operator changed it from the defaults. */
  multiplierTiers: z
    .array(z.object({ maxMonths: z.number().int().positive().nullable(), multiplier: z.number().min(1).max(5) }))
    .min(1)
    .max(8)
    .optional(),
  comps: z.array(compSchema).length(3, 'An FRV needs exactly three comps.'),
});

export type SubmitState = { error?: string } | undefined;

export async function submitFrv(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') return { error: 'Nothing was submitted.' };

  const parsed = payloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(' ') };
  }

  const { comps: compInput, preparedBy, justification, multiplierTiers: tiersInput, ...lossInput } = parsed.data;

  let loss: LossProperty = lossInput;
  if (tiersInput) {
    try {
      loss = { ...lossInput, multiplierTiers: tiersFromStored(tiersInput) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'The multiplier schedule is not valid.' };
    }
  }
  const comps: Comp[] = compInput.map((c, i) => ({ id: `c${i + 1}`, ...c }));

  // Throws ValidationFailedError if any rule blocks. The client cannot reach
  // this point with a blocking failure, but the server does not take its word.
  let calculation;
  try {
    calculation = calculateFrv(loss, comps);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Validation failed.' };
  }

  if (!isConfigured()) {
    return {
      error:
        'Supabase is not configured, so this FRV cannot be locked. Fill in .env.local and try again.',
    };
  }

  const supabase = db();

  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .insert({
      claim_identifier: loss.claimIdentifier,
      address: loss.address,
      lat: loss.lat,
      lng: loss.lng,
      bedrooms: loss.bedrooms,
      bathrooms: loss.bathrooms,
      sqft: loss.sqft,
      term_months: loss.termMonths,
      mgmt_fee_cents: loss.managementFeeCents,
      status: 'draft',
      created_by: preparedBy,
    })
    .select('id')
    .single<{ id: string }>();

  if (claimError || !claim) {
    return { error: `Could not create the claim: ${claimError?.message ?? 'unknown error'}` };
  }

  const { error: compsError } = await supabase.from('comps').insert(
    calculation.comps.map((comp) => ({
      claim_id: claim.id,
      url: comp.url,
      address: comp.address,
      rent_cents: comp.rentCents,
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      sqft: comp.sqft,
      furnished: false,
      lat: comp.lat,
      lng: comp.lng,
      distance_mi: Number(comp.distanceMiles.toFixed(2)),
      sort_position: comp.sortPosition,
      listing_source: comp.source ?? 'manual',
    })),
  );
  if (compsError) return { error: `Could not store the comps: ${compsError.message}` };

  const { error: calcError } = await supabase.from('calculations').insert({
    claim_id: claim.id,
    version: 1,
    multiplier: calculation.multiplier,
    multiplier_tiers: tiersToStored(calculation.multiplierTiers),
    furniture_cents: calculation.furnitureCents,
    mgmt_fee_cents: calculation.managementFeeCents,
    per_comp_frv_cents: calculation.comps.map((c) => c.frvCents),
    averaged_base_rent_cents: calculation.averagedBaseRentCents,
    averaged_frv_cents: calculation.averagedFrvCents,
    frv_12mo_cents: calculation.twelveMonthCents,
  });
  if (calcError) return { error: `Could not store the calculation: ${calcError.message}` };

  if (justification?.trim()) {
    await supabase.from('validation_events').insert({
      claim_id: claim.id,
      rule: 'rule-4-geography',
      outcome: 'acknowledged',
      detail: justification.trim(),
      actor_id: preparedBy,
    });
  }

  // Rule 2 and Rule 5 together: the number is fixed, and only now does sourcing open.
  const { error: lockError } = await supabase
    .from('claims')
    .update({ status: 'locked', locked_at: new Date().toISOString(), sourcing_unlocked: true })
    .eq('id', claim.id);
  if (lockError) return { error: `Could not lock the claim: ${lockError.message}` };

  await supabase.from('validation_events').insert({
    claim_id: claim.id,
    rule: 'rule-5-lock',
    outcome: 'pass',
    detail: 'Locked at version 1.',
    actor_id: preparedBy,
  });

  redirect(`/report?claim=${claim.id}`);
}

/**
 * Geocode an address to coordinates.
 *
 * US Census geocoder: free, no key, and the claim book is domestic. Everything
 * in Rule 4 anchors on these numbers, so they are captured once at intake and
 * persisted — never re-derived at comparison time.
 */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url =
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress' +
    `?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { addressMatches?: Array<{ coordinates?: { x: number; y: number } }> };
    };
    const match = json.result?.addressMatches?.[0]?.coordinates;
    return match ? { lat: match.y, lng: match.x } : null;
  } catch {
    // A failed lookup is not fatal: the operator can type coordinates, and the
    // alternative is blocking an FRV because a third-party service is down.
    return null;
  }
}

/**
 * Fill a comp from the URL the account manager pasted.
 *
 * Returns suggestions, never decisions: every field lands in an editable input,
 * and an expired listing is refused outright because a comp that is no longer
 * for rent is not evidence of anything.
 */
export async function lookupListing(url: string) {
  const { listingProvider } = await import('@/lib/listings');
  return listingProvider().lookup(url);
}

const searchSchema = z.object({
  address: z.string().min(3),
  lat: z.number(),
  lng: z.number(),
  bedrooms: z.number().int().min(1).max(10),
  bathrooms: z.number().min(0.5).max(10),
  sqft: z.number().int().positive(),
  radiusMiles: z
    .number()
    .refine((r) => (SEARCH_RADIUS_STEPS as readonly number[]).includes(r), 'Choose a radius from the picker.'),
});

/**
 * Shortlist active rentals near the loss that fit its size.
 *
 * Suggestions, never selections. The operator clicks one, and that click goes
 * through `lookupListing` like any pasted URL — so Rule 1 still reads the full
 * listing before a figure lands in a comp slot. Approved October 2026 as the
 * one sanctioned use of `rental_search`.
 */
export async function searchComps(input: unknown) {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, reason: 'no-region' as const, message: 'Fill in the loss address, bedrooms, bathrooms and square footage first.' };
  }
  const { listingProvider } = await import('@/lib/listings');
  return listingProvider().search(parsed.data);
}
