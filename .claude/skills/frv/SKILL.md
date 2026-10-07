---
name: frv
description: Work on the Nova Havens FRV (Fair Rental Value) calculator — the Next.js/Supabase tool that computes the monthly ALE housing ceiling for insurance claims. Use for any change to the calculation engine, validation rules, report/PDF, listing lookup, deploys, or CI.
---

# FRV

## What it does
FRV = (base comp rent × term multiplier) + furniture + management fee, applied to three unfurnished comps, sorted high→low, then averaged. Once submitted the figure is locked by Postgres triggers; changes go through `open_revision()`.

## Non-negotiables
- `src/lib/frv/constants.ts` holds the methodology defaults (multipliers, furniture, 5-mile cap). Change only with explicit sign-off. Multiplier tiers are editable per claim (Oct 2026); the schedule used is stored with the calculation. Defaults (Oct 2026): 90/80/70/60% for 1/2/3/4–11 months, none from 12.
- Money is integer cents. Never use floats for rent.
- Reference fixtures (Coppell $6,448.50, Camarillo $10,145) are computed under `LEGACY_MULTIPLIER_TIERS` — arithmetic regressions, not schedule gates.
- Furnished comps are rejected with no override; >5 miles halts; bathrooms are intentionally not matched.

## Commands
`npm ci` · `npm run verify` (typecheck + 55 tests + build) · `npm run dev`

## Learnings (hard-won)
- Keep React stable (^19) with Next ^15.5. The original `19.0.0-rc` pin broke `npm install` via `@react-pdf/renderer` peer deps.
- `renderToBuffer(createElement(Doc))` needs a cast to `ReactElement<DocumentProps>` under strict TS.
- `/api/health` returns 503 until Supabase env vars are set — expected. App still renders a clearly-labelled demo claim.
- Build must succeed with no secrets; env is validated at runtime in `src/lib/env.ts`.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIRECRAWL_API_KEY` (optional; empty = manual entry). No LISTING_PROVIDER var — Firecrawl is the only provider.
- Deploy: Vercel project `frv` (team nova-havens) auto-deploys from `main`. DB: Supabase project `Frv` (ref `yxblkcmojtnyzvshilqm`); apply `supabase/migrations/*.sql` in order, optional `seed.sql`.
- Supabase new-style keys: there is no `service_role` tab on new projects. Use the `sb_secret_…` key as `SUPABASE_SERVICE_ROLE_KEY`; supabase-js accepts it unchanged.
- Seed order matters: insert the claim as `draft`, attach comps + calculation, then lock. Inserting it locked first trips `comps_locked_guard`.
- Supabase lint 0011: every plpgsql function needs `set search_path = public, pg_temp` (migration 0002).
- PDF on Vercel: pdfkit's standard fonts are dynamically required and get dropped by output tracing → `Cannot find module …/standard-fonts/Helvetica.cjs`. Fixed with `outputFileTracingIncludes` in `next.config.mjs`; a local `next start` will NOT reproduce this, only Vercel does.
- Production is behind Vercel **password protection** (not SSO) so account managers without Vercel seats can open it. For automated checks: `POST _vercel_password=<pw>` → 303 + `_vercel_jwt` cookie (HttpOnly) → reuse the cookie.
- Browser E2E against the deployed app: wait for React hydration before typing (type a probe value and confirm it survives ~600ms), otherwise hydration resets SSR inputs. Wait for each comp's lookup note to appear before filling its fields, or the late Firecrawl response overwrites what you typed.
- Known UX gap: when Firecrawl reports a listing as expired, the form still fills the comp fields from it while saying it "cannot be used". Doc says expired is refused outright. Not yet reconciled.
- Flow: branch → PR → CI (`ci.yml`, npm ci) → merge to main → Vercel deploys.
- Supabase MCP gates any statement containing DELETE/TRUNCATE behind a user-approval prompt; if nobody clicks it, the call "times out" or comes back `cancelled`. For test-data cleanup, use the app's own client with the secret key instead: `open_revision()` → status `draft` → plain delete. Never bypass the guard with `set_config` from outside a revision.
- A BEFORE DELETE trigger must `return coalesce(new, old)`; `return new` is NULL on delete and silently skips the row (fixed in migration 0003).
- Comp search (`Find comparables`) = `rental_search` → `rankCandidates()` → operator clicks → existing `lookup()`. Gates in `DEFAULT_CRITERIA`, order by `scoreLikeness` then distance (never rent), both in `src/lib/listings/candidates.ts`; result filters in `filters.ts`; tests in `tests/candidates.test.ts` and `tests/filters.test.ts`. Radius is the operator's pick from `SEARCH_RADIUS_STEPS` (2.5 / 3 / 4 / 5 / 10 / 25 / 50 / 100, default 2.5, no auto-widening). `rental_search` has no radius filter, so geography is applied client-side from Haversine. A ≤2.5 mi search costs ~2 Firecrawl calls (ZIP, two pages); 3–5 mi adds the city; past 5 mi adds the state (4 pages per region, 10 total) and coverage thins. Results are unfurnished only: `rental_search` can't exclude furnished, so one `furnished=true` page per region is pulled and subtracted before ranking (one extra call per region); Rule 1's full-text check on pick is still the final gate. Candidates past 5 mi show a light red hue and an "Outside 5 mi · Rule 4" chip and Use stays enabled, but Rule 4 is unchanged: the engine blocks such a comp at calculation, so it can't lock. Each pick 1 more call.
- "Prepared by" is a dropdown from the `account_managers` table (migration `0005`; `listAccountManagers()` in `src/lib/db/account-managers.ts`; fallback `DEFAULT_ACCOUNT_MANAGERS` in `src/lib/account-managers.ts`). The server action rejects names not on the list. Add or retire a name by editing the table, no deploy.
- Migrations: `0001` init + lock triggers, `0002` pinned search_path, `0003` delete-trigger return, `0004` `calculations.multiplier_tiers`, `0005` `account_managers`.
