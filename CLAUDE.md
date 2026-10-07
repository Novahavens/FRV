# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FRV calculates the **Fair Rental Value** — the monthly housing ceiling on an insurance ALE claim — for Nova Havens, a neutral third party. An account manager enters the loss property and three unfurnished Zillow comps; the tool validates the five methodology rules, computes the figure, locks it in Postgres, and renders a one-page report (web + PDF) an adjuster can approve.

```
per comp:  (base rent × term multiplier) + furniture + management fee
output:    mean of the three comps, selected high → low
```

Next.js 15 (App Router) · React 19 · TypeScript strict · Supabase Postgres · Vitest · `@react-pdf/renderer`. Deployed on Vercel (team `nova-havens`, project `frv`) from `main`.

## Commands

```bash
npm ci                       # install (lockfile is committed; CI uses npm ci)
npm run dev                  # localhost:3000
npm run verify               # typecheck + tests + build — run before every push
npm run typecheck            # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm test                     # vitest run (tests/**/*.test.ts, node env)
npx vitest run tests/calculate.test.ts           # one file
npx vitest run -t "Coppell"                      # tests matching a name
npm run build                # next build — must succeed with NO env vars set
```

Env (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a Supabase `sb_secret_…` key works here), `FIRECRAWL_API_KEY` (optional; empty = manual comp entry), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional; empty = plain loss-address input, Census geocoding on blur), `GOOGLE_MAPS_SERVER_KEY` (optional, server-only; empty = no Street View / aerial map on the report). Without Supabase configured the app renders the Coppell demo claim and `/api/health` returns 503 — that is by design, not a bug.

Database: apply `supabase/migrations/*.sql` in order (`0001` init and lock triggers, `0002` pinned search_path, `0003` delete-trigger return fix, `0004` stored multiplier schedule, `0005` `account_managers`), then optionally `supabase/seed.sql`.

**"Prepared by" is a list.** The intake dropdown reads `account_managers (name, active, sort_order)` through `src/lib/db/account-managers.ts#listAccountManagers()` (active names only); `claims/new/actions.ts` rejects a name not on the list, so the audit trail carries one canonical name per person. Add or retire a name by editing the table, no deploy. Without Supabase the form uses `DEFAULT_ACCOUNT_MANAGERS` in `src/lib/account-managers.ts`. The table is not under the claim lock; it is reference data, not part of any claim. This is not authentication.

## Architecture — the parts that span files

**`src/lib/frv/` is a pure island.** No React, Next, Supabase or network imports. The browser (`ClaimForm.tsx`) and the server action (`claims/new/actions.ts`) run the *same* `calculateFrv()`; the server always recomputes on submit and that result is what gets stored. `index.ts` re-exports everything — import from `@/lib/frv`.

- `constants.ts` — the methodology defaults (multiplier tiers, furniture by bedroom, 5-mile cap, 15% sqft tolerance). Changing a value needs Lou's sign-off. **Multiplier tiers are defaults, editable per claim** (Oct 2026): `LossProperty.multiplierTiers` overrides them, `calculateFrv` validates via `assertValidTiers`, the schedule used is returned on `Calculation.multiplierTiers`, stored in `calculations.multiplier_tiers` (jsonb, open-ended tier as `maxMonths: null` via `tiersToStored`/`tiersFromStored`) and printed on the report. `LEGACY_MULTIPLIER_TIERS` is the pre-Oct-2026 schedule, used to read rows stored without one.
- `validate.ts` → `calculate.ts` — `calculateFrv` re-runs `validate()` and **throws `ValidationFailedError`** on any blocking event rather than returning a figure with a caveat.
- `money.ts` — all money is **integer cents** (`Cents`). Dollars exist only in `parseMoneyToCents` / `formatCents`. Rounding is half-away-from-zero (matches a calculator), not banker's.

**Selection vs output are two decisions.** `sortHighToLow` picks order (ceiling logic); the average is the output. `sort_position` is persisted on `comps` and never recomputed at render.

**The lock is a Postgres trigger, not UI state** (`supabase/migrations/0001_init.sql`). Once `claims.status = 'locked'`, triggers reject updates/deletes on `claims`, `comps`, `calculations` — from the app, scripts, or the dashboard. `open_revision(claim_id, reason, actor, note)` is the only way through: it sets a transaction-scoped `app.revision_open` flag, writes a reason-coded `revisions` row, and reopens the claim at the next version. A `check (furnished = false)` constraint means a furnished comp cannot even be stored. Seed data must insert the claim as `draft`, attach comps, then lock.

**Reports render from stored figures.** `src/lib/db/claims.ts#loadLockedClaim` reads the `calculations` row and never calls the engine, so arithmetic changes cannot restate an accepted report. `src/lib/report/model.ts#buildReportModel` produces one `ReportModel` that feeds both `components/report/ReportSheet.tsx` (web) and `ReportDocument.tsx` (PDF via `api/claims/[id]/report/route.ts`). Guideline tables in the report are generated from `constants.ts`, so they can't disagree with the engine.

**Listing lookup is narrow and optional.** `src/lib/listings/` wraps Firecrawl's Zillow capabilities behind `ListingProvider`: `lookup(url)` (`properties/rental`) fills fields for one listing; `search(query)` (`properties/rental_search`, approved Oct 2026) returns a *shortlist* the operator picks from — filtering/ranking is the pure `candidates.ts#rankCandidates` (eligibility: ±1 bed, ±1 bath, ±15% sqft, active only, no buildings, inside the operator's radius — 2.5 mi by default, picker over `SEARCH_RADIUS_STEPS` 2.5/3/4/5/10/25/50/100, no automatic widening; order: `scoreLikeness` first, distance as tiebreaker, never rent) and is unit-tested. **Search returns unfurnished homes only:** `rental_search` can restrict *to* furnished but not away from it, so each search also pulls one `furnished=true` page per region and subtracts those before ranking (one extra Firecrawl call per region); Rule 1's full-text check on pick stays the final gate. Past 5 miles the region strategy adds the state (4 pages per region, 10 total) and coverage thins, since Zillow has no radius search. Candidates past 5 mi get a light red hue and a "Past 5 mi" chip as a cue. **Rule 4's extended band** (Oct 2026, Fazal): 5–100 mi is permitted with an `info` event and no justification (`RADIUS_BANDS.limit = 100`); past 100 mi the engine still blocks. Result filtering (home type, pets, available-by, exact beds/baths) is the pure `filters.ts`; the UI lives in `src/components/comps/`. Amenities are not in search records and are not fetched. Picking a candidate calls the same `lookup`, so Rule 1 and the audit trail are identical to a pasted URL. The search never writes to a claim. Every field stays editable; `overridden_fields` records what a human changed; expired listings are refused; `listing_source = 'firecrawl-zillow'` obliges the report to print Zillow attribution. Without a key, `listingProvider()` returns a manual provider and the form works identically.

**Geocoding** for the loss address uses the US Census geocoder (free, no key) in `actions.ts#geocode`; coordinates are captured once at intake and persisted because Rule 4 (radius bands) depends on them.

## Deliberate decisions that look like bugs

Read `docs/DECISIONS.md` before "fixing" any of these:
- Bathroom count is **not** matched (bedrooms are).
- Validation throws instead of warning.
- There is no `market_value` column and never should be.
- The evaluation-note wording about amenities is reproduced verbatim from reference reports despite the tool having no amenity fields (open with Will).
- Not built on purpose: comp discovery, an interactive map on the intake form, amenity fields, insured-facing views. (The *report* does carry static Street View + aerial-map imagery when `GOOGLE_MAPS_SERVER_KEY` is set — `src/lib/maps/`, served through `/api/claims/[id]/street-view|map` so the key stays server-side. Optional; nothing renders differently without it.)

## Reference fixtures

`tests/calculate.test.ts` and `tests/report.test.ts` compute the PRD reference reports **under `LEGACY_MULTIPLIER_TIERS`**: Coppell TX = $6,448.50, Camarillo CA = $10,145. They are arithmetic regressions, not methodology gates — if they move, the *engine* changed, not the schedule. Default-schedule behaviour is asserted separately (Oct 2026 defaults: 1 mo ×1.90, 2 mo ×1.80, 3 mo ×1.70, 4–11 mo ×1.60, 12+ ×1.00).

**Loss address autocomplete** (`src/components/forms/AddressAutocomplete.tsx`) uses Google Places only when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set; otherwise it renders the plain `Field` and `actions.ts#geocode` (US Census) runs on blur. The build must pass with no key. **Comp search is Zillow-only by decision** (Furnished Finder declined — see `docs/DECISIONS.md`).

## Deployment notes

- Vercel production has **password protection** (not Vercel SSO) so account managers without Vercel seats can use it. Automated checks need the `_vercel_jwt` cookie from a POST of `_vercel_password`.
- `next.config.mjs` has `outputFileTracingIncludes` for the PDF route: pdfkit loads its standard fonts with a dynamic require that tracing can't see, and without it the route 500s on Vercel with `Cannot find module …/standard-fonts/Helvetica.cjs`. Keep it.
- `@react-pdf/renderer` is in `serverExternalPackages`; `renderToBuffer(createElement(ReportDocument, …))` needs a cast to `ReactElement<DocumentProps>` under strict TS.
- The route is `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` — react-pdf needs Node, and a cached report can disagree with its record.

## Workflow

Branch → PR → CI (`.github/workflows/ci.yml`: typecheck, tests, build) → merge to `main` → Vercel auto-deploys production. Commit messages use conventional prefixes (`feat(core):`, `fix(pdf):`, `db:`, `docs:`).

See also `.claude/skills/frv/SKILL.md` for the operational checklist.
