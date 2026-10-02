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

Env (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (a Supabase `sb_secret_…` key works here), `FIRECRAWL_API_KEY` (optional; empty = manual comp entry). Without Supabase configured the app renders the Coppell demo claim and `/api/health` returns 503 — that is by design, not a bug.

Database: apply `supabase/migrations/*.sql` in order, then optionally `supabase/seed.sql`.

## Architecture — the parts that span files

**`src/lib/frv/` is a pure island.** No React, Next, Supabase or network imports. The browser (`ClaimForm.tsx`) and the server action (`claims/new/actions.ts`) run the *same* `calculateFrv()`; the server always recomputes on submit and that result is what gets stored. `index.ts` re-exports everything — import from `@/lib/frv`.

- `constants.ts` — the locked methodology (multiplier tiers, furniture by bedroom, 5-mile cap, 15% sqft tolerance). Changing a value needs Lou's sign-off. The 6–9 month tier is **25%**; a Drive template saying 24% is wrong and a test asserts this.
- `validate.ts` → `calculate.ts` — `calculateFrv` re-runs `validate()` and **throws `ValidationFailedError`** on any blocking event rather than returning a figure with a caveat.
- `money.ts` — all money is **integer cents** (`Cents`). Dollars exist only in `parseMoneyToCents` / `formatCents`. Rounding is half-away-from-zero (matches a calculator), not banker's.

**Selection vs output are two decisions.** `sortHighToLow` picks order (ceiling logic); the average is the output. `sort_position` is persisted on `comps` and never recomputed at render.

**The lock is a Postgres trigger, not UI state** (`supabase/migrations/0001_init.sql`). Once `claims.status = 'locked'`, triggers reject updates/deletes on `claims`, `comps`, `calculations` — from the app, scripts, or the dashboard. `open_revision(claim_id, reason, actor, note)` is the only way through: it sets a transaction-scoped `app.revision_open` flag, writes a reason-coded `revisions` row, and reopens the claim at the next version. A `check (furnished = false)` constraint means a furnished comp cannot even be stored. Seed data must insert the claim as `draft`, attach comps, then lock.

**Reports render from stored figures.** `src/lib/db/claims.ts#loadLockedClaim` reads the `calculations` row and never calls the engine, so arithmetic changes cannot restate an accepted report. `src/lib/report/model.ts#buildReportModel` produces one `ReportModel` that feeds both `components/report/ReportSheet.tsx` (web) and `ReportDocument.tsx` (PDF via `api/claims/[id]/report/route.ts`). Guideline tables in the report are generated from `constants.ts`, so they can't disagree with the engine.

**Listing lookup is narrow and optional.** `src/lib/listings/` wraps Firecrawl's Zillow `properties/rental` capability behind `ListingProvider`. It fills fields for a URL the operator already chose — never comp discovery (`rental_search` is excluded by the PRD). Every field stays editable; `overridden_fields` records what a human changed; expired listings are refused; `listing_source = 'firecrawl-zillow'` obliges the report to print Zillow attribution. Without a key, `listingProvider()` returns a manual provider and the form works identically.

**Geocoding** for the loss address uses the US Census geocoder (free, no key) in `actions.ts#geocode`; coordinates are captured once at intake and persisted because Rule 4 (radius bands) depends on them.

## Deliberate decisions that look like bugs

Read `docs/DECISIONS.md` before "fixing" any of these:
- Bathroom count is **not** matched (bedrooms are).
- Validation throws instead of warning.
- There is no `market_value` column and never should be.
- The evaluation-note wording about amenities is reproduced verbatim from reference reports despite the tool having no amenity fields (open with Will).
- Not built on purpose: comp discovery, maps, amenity fields, insured-facing views.

## Fixtures that must hold to the cent

`tests/calculate.test.ts` and `tests/report.test.ts` pin the PRD reference reports: **Coppell TX (3 comps, 3 months) = $6,448.50** and **Camarillo CA (2 months) = $10,145**. If either moves by a cent, the methodology changed — stop and confirm.

## Deployment notes

- Vercel production has **password protection** (not Vercel SSO) so account managers without Vercel seats can use it. Automated checks need the `_vercel_jwt` cookie from a POST of `_vercel_password`.
- `next.config.mjs` has `outputFileTracingIncludes` for the PDF route: pdfkit loads its standard fonts with a dynamic require that tracing can't see, and without it the route 500s on Vercel with `Cannot find module …/standard-fonts/Helvetica.cjs`. Keep it.
- `@react-pdf/renderer` is in `serverExternalPackages`; `renderToBuffer(createElement(ReportDocument, …))` needs a cast to `ReactElement<DocumentProps>` under strict TS.
- The route is `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` — react-pdf needs Node, and a cached report can disagree with its record.

## Workflow

Branch → PR → CI (`.github/workflows/ci.yml`: typecheck, tests, build) → merge to `main` → Vercel auto-deploys production. Commit messages use conventional prefixes (`feat(core):`, `fix(pdf):`, `db:`, `docs:`).

See also `.claude/skills/frv/SKILL.md` for the operational checklist.
