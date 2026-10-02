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
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LISTING_PROVIDER` (`firecrawl`|`manual`), `FIRECRAWL_API_KEY`.
- Deploy: Vercel project `frv` (team nova-havens) auto-deploys from `main`. DB: run `supabase/migrations/0001_init.sql`, optional `seed.sql`.
- Flow: branch → PR → CI (`ci.yml`, npm ci) → merge to main → Vercel deploys.
