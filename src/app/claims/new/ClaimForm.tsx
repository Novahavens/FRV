'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import {
  MULTIPLIER_TIERS,
  REQUIRED_COMP_COUNT,
  calculateFrv,
  formatCents,
  markupLabel,
  parseListingUrl,
  parseMoneyToCents,
  tierLabel,
  tiersToStored,
  validate,
  type Calculation,
  type Comp,
  type LossProperty,
  type MultiplierTier,
} from '@/lib/frv';
import { Button, Field, RuleBanner } from '@/components/ui/primitives';
import { FrvSummary } from '@/components/frv/FrvSummary';
import type { CompCandidate, SearchResult } from '@/lib/listings/types';
import { geocode, lookupListing, searchComps, submitFrv, type SubmitState } from './actions';
import styles from './ClaimForm.module.css';

/**
 * One page. The figure updates as you type, and submit is the only state change.
 *
 * The calculation core is pure and has no I/O, so the browser runs exactly the
 * same code the server runs on submit. That is what makes a live preview
 * trustworthy rather than an approximation of the real answer — and the server
 * still recomputes, because a figure that reaches an adjuster must not have been
 * produced on a machine we do not control.
 */

interface CompDraft {
  url: string;
  address: string;
  rent: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  furnished: boolean;
  lat: string;
  lng: string;
  /** Where the figures came from, and anything the operator should know. */
  source: 'manual' | 'firecrawl-zillow';
  note: string | null;
  attribution: string | null;
}

const emptyComp = (): CompDraft => ({
  url: '', address: '', rent: '', bedrooms: '', bathrooms: '',
  sqft: '', furnished: false, lat: '', lng: '',
  source: 'manual', note: null, attribution: null,
});

const num = (v: string) => {
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export function ClaimForm() {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitFrv, undefined);
  const [geocoding, startGeocode] = useTransition();

  const [preparedBy, setPreparedBy] = useState('');
  const [claimIdentifier, setClaimIdentifier] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [bedrooms, setBedrooms] = useState('4');
  const [bathrooms, setBathrooms] = useState('2');
  const [sqft, setSqft] = useState('');
  const [termMonths, setTermMonths] = useState('3');
  const [managementFee, setManagementFee] = useState('240');
  const [justification, setJustification] = useState('');

  /**
   * The multiplier schedule, as percentage markups the operator can edit.
   * Boundaries are fixed; the percentages are not. Whatever is entered is used
   * for the live figure, recomputed on the server, stored with the calculation
   * and printed on the report's guideline table.
   */
  const defaultMarkups = () => MULTIPLIER_TIERS.map((t) => String(Math.round((t.multiplier - 1) * 10_000) / 100));
  const [markups, setMarkups] = useState<string[]>(defaultMarkups);
  const markupsAreDefault = markups.every((m, i) => m === defaultMarkups()[i]);
  const tiers: MultiplierTier[] | null = useMemo(() => {
    const built = MULTIPLIER_TIERS.map((t, i) => ({ maxMonths: t.maxMonths, multiplier: 1 + num(markups[i] ?? '') / 100 }));
    return built.every((t) => Number.isFinite(t.multiplier) && t.multiplier >= 1 && t.multiplier <= 5) ? built : null;
  }, [markups]);

  const [comps, setComps] = useState<CompDraft[]>(() =>
    Array.from({ length: REQUIRED_COMP_COUNT }, emptyComp),
  );

  const patchComp = (index: number, patch: Partial<CompDraft>) =>
    setComps((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  /**
   * Paste a listing URL and the address falls out of it.
   *
   * There is no public Zillow API — it was retired in 2021 and what is sold as
   * one today is a scraper wrapper, which PRD 1.1 rules out. So Zillow stays the
   * search tool and the operator keys the figures. Everything here is editable
   * because the parse is a convenience, not a source of truth.
   */
  const [fetching, setFetching] = useState<number | null>(null);

  /**
   * Paste a Zillow URL and the comp fills itself.
   *
   * Firecrawl's catalogued Zillow capability returns rent, beds, baths, square
   * footage and coordinates for the one listing the operator chose. If the
   * lookup is off or fails, the address is still read from the URL and the rest
   * is keyed by hand. Picking a search candidate below lands here too, so a
   * found comp goes through exactly the same checks as a pasted one.
   */
  const handleUrlPaste = (index: number, url: string) => {
    patchComp(index, { url, note: null });
    const parsed = parseListingUrl(url);
    if (!parsed.address) return;

    patchComp(index, { url, address: parsed.address });
    setFetching(index);

    startGeocode(async () => {
      const result = await lookupListing(url);

      if (result.ok) {
        const f = result.facts;
        patchComp(index, {
          address: f.address ?? parsed.address!,
          rent: f.rentCents != null ? (f.rentCents / 100).toLocaleString('en-US') : '',
          bedrooms: f.bedrooms != null ? String(f.bedrooms) : '',
          bathrooms: f.bathrooms != null ? String(f.bathrooms) : '',
          sqft: f.sqft != null ? String(f.sqft) : '',
          lat: f.lat != null ? String(f.lat) : '',
          lng: f.lng != null ? String(f.lng) : '',
          furnished: f.furnished ?? false,
          source: 'firecrawl-zillow',
          attribution: f.attribution,
          note: f.active
            ? 'Filled from the listing. Check every figure against the page before locking.'
            : 'This listing is not currently for rent. Choose an active comparable.',
        });
      } else {
        const point = await geocode(parsed.address!);
        patchComp(index, {
          ...(point ? { lat: String(point.lat), lng: String(point.lng) } : {}),
          note: result.message,
        });
      }
      setFetching(null);
    });
  };

  const lookUpLoss = () => {
    if (!address.trim()) return;
    startGeocode(async () => {
      const point = await geocode(address);
      if (point) {
        setLat(String(point.lat));
        setLng(String(point.lng));
      }
    });
  };


  const loss: LossProperty | null = useMemo(() => {
    const parsedFee = parseMoneyToCents(managementFee);
    if (!address || !lat || !lng || !sqft || parsedFee == null || !tiers) return null;
    const draft = {
      claimIdentifier: claimIdentifier || 'Untitled claim',
      address,
      lat: num(lat), lng: num(lng),
      bedrooms: num(bedrooms), bathrooms: num(bathrooms),
      sqft: num(sqft), termMonths: num(termMonths),
      managementFeeCents: parsedFee,
    };
    return Object.values(draft).some((v) => typeof v === 'number' && Number.isNaN(v))
      ? null
      : { ...draft, multiplierTiers: tiers };
  }, [claimIdentifier, address, lat, lng, bedrooms, bathrooms, sqft, termMonths, managementFee, tiers]);

  /**
   * Find comps near the loss.
   *
   * A shortlist, not a selection: active rentals within the radius bands that
   * fit the loss on bedrooms (±1), bathrooms (±1) and square footage (±15%),
   * closest first. The operator chooses which slot each one fills, and the
   * choice runs the single-listing lookup so Rule 1 sees the full text.
   * Approved October 2026; see docs/DECISIONS.md.
   */
  const [searching, startSearch] = useTransition();
  const [search, setSearch] = useState<SearchResult | null>(null);

  const canSearch = Boolean(loss) && !searching;

  const findComps = () => {
    if (!loss) return;
    startSearch(async () => {
      setSearch(await searchComps({
        address: loss.address, lat: loss.lat, lng: loss.lng,
        bedrooms: loss.bedrooms, bathrooms: loss.bathrooms, sqft: loss.sqft,
      }));
    });
  };

  const useCandidate = (candidate: CompCandidate, slot: number) => {
    handleUrlPaste(slot, candidate.url);
  };

  const slotLabel = (i: number) => (comps[i]?.url ? `Replace ${i + 1}` : `Use as ${i + 1}`);

  const readyComps: Comp[] | null = useMemo(() => {
    const built = comps.map((c, i): Comp | null => {
      const rentCents = parseMoneyToCents(c.rent);
      if (!c.address || rentCents == null || !c.sqft || !c.lat || !c.lng) return null;
      return {
        id: `c${i + 1}`, url: c.url || 'https://www.zillow.com/', address: c.address,
        rentCents, bedrooms: num(c.bedrooms), bathrooms: num(c.bathrooms),
        sqft: num(c.sqft), furnished: c.furnished, lat: num(c.lat), lng: num(c.lng),
        source: c.source,
      };
    });
    return built.every((c): c is Comp => c !== null) ? built : null;
  }, [comps]);

  const { calculation, events, blocked, needsJustification } = useMemo(() => {
    if (!loss || !readyComps) {
      return { calculation: null, events: [], blocked: false, needsJustification: false };
    }
    const result = validate(loss, readyComps);
    let calc: Calculation | null = null;
    if (result.passed) {
      try { calc = calculateFrv(loss, readyComps); } catch { calc = null; }
    }
    return {
      calculation: calc,
      events: result.events,
      blocked: !result.passed,
      needsJustification: result.requiresJustification.length > 0,
    };
  }, [loss, readyComps]);

  const justificationMissing = needsJustification && justification.trim().length < 10;
  const canSubmit =
    Boolean(calculation) && !blocked && !justificationMissing && preparedBy.trim().length >= 2;

  const payload = JSON.stringify(
    loss && readyComps
      ? {
          ...loss,
          // JSON has no Infinity; the open-ended tier travels as maxMonths null.
          multiplierTiers: tiersToStored(loss.multiplierTiers ?? MULTIPLIER_TIERS),
          preparedBy: preparedBy.trim(),
          justification,
          comps: readyComps.map(({ id: _id, ...c }) => c),
        }
      : {},
  );

  return (
    <form action={formAction} className={styles.layout}>
      <input type="hidden" name="payload" value={payload} />

      <div className={styles.inputs}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Loss property</h2>
          <div className={styles.pair}>
            <Field id="loss-claim-id" label="Claim identifier" value={claimIdentifier} placeholder="NH-2026-0417-A"
              onChange={(e) => setClaimIdentifier(e.target.value)}
              helper="Free text. Not always numeric." />
            <Field id="loss-prepared-by" label="Prepared by" value={preparedBy} placeholder="Your name"
              onChange={(e) => setPreparedBy(e.target.value)}
              helper="Goes on the audit trail with this FRV." />
          </div>

          <Field id="loss-address" label="Loss address" value={address} placeholder="205 Park Meadow Way, Coppell TX 75019"
            onChange={(e) => setAddress(e.target.value)} onBlur={lookUpLoss}
            helper={lat && lng ? `Located at ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}` : 'Coordinates are looked up when you leave this field.'} />

          <div className={styles.quad}>
            <Field id="loss-beds" label="Bedrooms" value={bedrooms} mono inputMode="numeric"
              onChange={(e) => setBedrooms(e.target.value)} />
            <Field id="loss-baths" label="Bathrooms" value={bathrooms} mono inputMode="decimal"
              onChange={(e) => setBathrooms(e.target.value)} />
            <Field id="loss-sqft" label="Square footage" value={sqft} mono inputMode="numeric" placeholder="2,100"
              onChange={(e) => setSqft(e.target.value)} />
            <Field id="loss-term" label="Approved term" value={termMonths} mono inputMode="numeric"
              onChange={(e) => setTermMonths(e.target.value)} helper="Months" />
          </div>

          <Field id="loss-fee" label="Monthly management fee" value={managementFee} prefix="$" mono
            onChange={(e) => setManagementFee(e.target.value)}
            helper="Default $240. Zero is permitted on standard sourcing." />
        </section>

        <section className={styles.card} aria-labelledby="multipliers-title">
          <div className={styles.findRow}>
            <div>
              <h2 id="multipliers-title" className={styles.cardTitle}>Short-term multipliers</h2>
              <p className={styles.findNote}>
                Markup on base rent by approved term. Edit any tier; the figure updates, and the
                schedule you use is stored with the claim and printed on the report.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMarkups(defaultMarkups())}
              disabled={markupsAreDefault}>
              Reset to defaults
            </Button>
          </div>
          <div className={styles.tiers}>
            {MULTIPLIER_TIERS.map((t, i) => (
              <Field key={t.maxMonths} id={`tier-${i}`} label={tierLabel(MULTIPLIER_TIERS, i)} value={markups[i] ?? ''}
                mono inputMode="decimal" prefix="%"
                onChange={(e) => setMarkups((prev) => prev.map((m, j) => (j === i ? e.target.value : m)))}
                helper={tiers ? `× ${tiers[i]!.multiplier.toFixed(4).replace(/\.?0+$/, '')}` : undefined}
                error={tiers ? undefined : 'Each markup must be a number from 0 to 400.'} />
            ))}
          </div>
          {!markupsAreDefault && tiers && (
            <p className={styles.findNote}>
              Custom schedule: {tiers.map((t, i) => `${tierLabel(MULTIPLIER_TIERS, i)} ${markupLabel(t.multiplier)}`).join(' · ')}.
              Defaults are {MULTIPLIER_TIERS.map((t) => markupLabel(t.multiplier)).join(' / ')}.
            </p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="find-comps-title">
          <div className={styles.findRow}>
            <div>
              <h2 id="find-comps-title" className={styles.cardTitle}>Find comparables</h2>
              <p className={styles.findNote}>
                Active Zillow rentals near the loss address that fit it on bedrooms, bathrooms and
                size. Closest first. You choose which three.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={findComps} disabled={!canSearch} loading={searching}
              id="find-comps">
              {searching ? 'Searching' : search ? 'Search again' : 'Find comps'}
            </Button>
          </div>

          {!loss && (
            <p className={styles.findNote}>Enter the loss address, bedrooms, bathrooms and square footage to search.</p>
          )}

          {search && !search.ok && (
            <RuleBanner tone="warn" message="No shortlist this time." detail={search.message} />
          )}

          {search?.ok && search.candidates.length === 0 && (
            <RuleBanner tone="warn" message={`Nothing within five miles of ${search.searched} fits the loss property.`}
              detail="Widen by hand: paste listing URLs into the comparables below. Comps past five miles are blocked either way." />
          )}

          {search?.ok && search.candidates.length > 0 && (
            <>
              {search.widened && (
                <RuleBanner tone="warn" message="Fewer than six matches within two miles, so the list reaches to five."
                  detail="Anything marked 2–5 mi will need a written justification before you can lock." />
              )}
              <ul className={styles.candidates} aria-label="Comparable candidates">
                {search.candidates.map((c) => (
                  <li key={c.zpid} className={styles.candidate}>
                    <div>
                      <p className={styles.candidateAddress}>
                        <a href={c.url} target="_blank" rel="noreferrer">{c.address}</a>
                        <span className={`${styles.candidateBand} ${c.band === 'needs-justification' ? styles.bandWarn : styles.bandPass}`}>
                          {c.distanceMiles.toFixed(1)} mi{c.band === 'needs-justification' ? ' · needs justification' : ''}
                        </span>
                      </p>
                      <p className={styles.candidateMeta}>
                        {formatCents(c.rentCents)}/mo · {c.bedrooms} bd · {c.bathrooms} ba · {c.sqft.toLocaleString()} sq ft
                        {c.homeType ? ` · ${c.homeType.toLowerCase().replace(/_/g, ' ')}` : ''}
                      </p>
                    </div>
                    <div className={styles.candidateActions}>
                      {comps.map((_, i) => (
                        <Button key={i} type="button" size="sm" variant="ghost" onClick={() => useCandidate(c, i)}
                          disabled={fetching !== null}>
                          {slotLabel(i)}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {search.attribution && <p className={styles.attribution}>{search.attribution}</p>}
            </>
          )}
        </section>

        {comps.map((comp, i) => (
          <section key={i} className={styles.card}>
            <h2 className={styles.cardTitle}>Comparable {i + 1}</h2>
            <Field id={`comp-${i}-url`} label="Listing URL" value={comp.url} placeholder="Paste the Zillow listing URL"
              onChange={(e) => handleUrlPaste(i, e.target.value)}
              helper={fetching === i ? 'Reading the listing…' : comp.note ?? 'Paste a Zillow listing URL. Rent, size and location fill in; everything stays editable.'} />
            <Field id={`comp-${i}-address`} label="Address" value={comp.address}
              onChange={(e) => patchComp(i, { address: e.target.value })} />
            <div className={styles.quad}>
              <Field id={`comp-${i}-rent`} label="Rent" value={comp.rent} prefix="$" mono placeholder="3,835"
                onChange={(e) => patchComp(i, { rent: e.target.value })} />
              <Field id={`comp-${i}-beds`} label="Bedrooms" value={comp.bedrooms} mono inputMode="numeric"
                onChange={(e) => patchComp(i, { bedrooms: e.target.value })} />
              <Field id={`comp-${i}-baths`} label="Bathrooms" value={comp.bathrooms} mono inputMode="decimal"
                onChange={(e) => patchComp(i, { bathrooms: e.target.value })} />
              <Field id={`comp-${i}-sqft`} label="Square footage" value={comp.sqft} mono inputMode="numeric"
                onChange={(e) => patchComp(i, { sqft: e.target.value })} />
            </div>
            <div className={styles.pair}>
              <Field id={`comp-${i}-lat`} label="Latitude" value={comp.lat} mono onChange={(e) => patchComp(i, { lat: e.target.value })} />
              <Field id={`comp-${i}-lng`} label="Longitude" value={comp.lng} mono onChange={(e) => patchComp(i, { lng: e.target.value })} />
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={comp.furnished}
                onChange={(e) => patchComp(i, { furnished: e.target.checked })} />
              <span>This listing is furnished</span>
            </label>
          </section>
        ))}
      </div>

      <aside className={styles.preview}>
        <div className={styles.sticky}>
          {calculation ? (
            <FrvSummary calculation={calculation} />
          ) : (
            <section className={styles.empty}>
              <p className={styles.emptyFigure}>$0</p>
              <p className={styles.emptyText}>
                Enter the loss property and three unfurnished comparables. The figure
                appears here as you type.
              </p>
            </section>
          )}

          <div className={styles.banners}>
            {events.map((event, i) => (
              <RuleBanner key={`${event.rule}-${event.compId ?? i}`} tone={event.tone}
                rule={event.rule.replace(/-/g, ' ')} message={event.message} detail={event.detail} />
            ))}
          </div>

          {needsJustification && (
            <Field id="justification" label="Justification" value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why this comparable is still the right one"
              error={justificationMissing ? 'Warnings need a written justification before you can submit.' : undefined}
              helper="Stored with the claim as an acknowledgement." />
          )}

          {state?.error && (
            <RuleBanner tone="block" message="This FRV was not locked." detail={state.error} />
          )}

          <Button type="submit" size="lg" disabled={!canSubmit} loading={pending}>
            {pending ? 'Locking' : 'Submit and lock'}
          </Button>
          <p className={styles.lockNote}>
            Locking fixes this figure permanently and opens sourcing. Changing it afterwards
            needs a documented revision.
          </p>
          {calculation && (
            <p className={styles.runningTotal}>
              Twelve-month equivalent {formatCents(calculation.twelveMonthCents)}
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}
