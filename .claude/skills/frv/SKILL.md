---
name: frv
description: Work on the Nova Havens FRV (Fair Rental Value) calculator — the Next.js/Supabase tool that computes the monthly ALE housing ceiling for insurance claims. Use for any change to the calculation engine, validation rules, report/PDF, listing lookup, deploys, or CI.
---

# FRV

## What it does
FRV = (base comp rent × term multiplier) + furniture + management fee, applied to three unfurnished comps, sorted high→low, then averaged. Once submitted the figure is locked by Postgres triggers; changes go through `open_revision()`.

## Non-negotiables
- `src/lib/frv/constants.ts` is the locked methodology (multipliers, furniture, 5-mile cap). Change only with explicit sign-off. 6–9 month tier is **25%**, not 24%.
- Money is integer cents. Never use floats for rent.
- Fixtures must hold to the cent: Coppell TX = $6,448.50; Camarillo CA = $10,145.
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
- Comp search (`Find comparables`) = `rental_search` → `rankCandidates()` → operator clicks → existing `lookup()`. Tune criteria in `DEFAULT_CRITERIA` (`src/lib/listings/candidates.ts`); tests in `tests/candidates.test.ts`. Each search costs ~2 Firecrawl calls (two pages of 41), each pick 1 more. `rental_search` has no radius filter — geography is applied client-side from Haversine.
