---
name: frvcalcupdate
description: Change how the FRV is calculated or how the report looks — multiplier tiers, furniture rates, management fee, comp count/rules, radius bands, and the report's headings, content blocks, logo and declarations. Use for any request like "change the 6–9 month multiplier", "make the fee $300", "allow four comps", "rename a report section", "swap the logo", or "edit the neutrality text".
---

# FRV calculation & report updates

Every change here is a **methodology or carrier-facing change**, not a code change. Follow the protocol, then the recipe for the thing being changed.

## Protocol (always)

1. **Confirm sign-off.** Numbers in `src/lib/frv/constants.ts` are Lou's decisions on record. Declarations in `src/lib/report/declarations.ts` are verbatim from the reference reports and open with Will. Don't change either on an unconfirmed ask — state what will change, who owns it, and get a yes.
2. **Branch** from `main`: `git checkout -b feat(calc)/<what>` (or `fix(report)/…`).
3. **Make the change in exactly one source of truth** (recipes below). Never hardcode a second copy — the report tables are generated from the same constants the engine uses, so a value only needs to move once.
4. **Update the fixtures deliberately.** `tests/calculate.test.ts` and `tests/report.test.ts` pin Coppell = **$6,448.50** and Camarillo = **$10,145** to the cent. If the change *should* move them, recompute by hand, update the expected values in the same commit, and say so in the PR body. If it *shouldn't* move them and does, stop — something leaked.
5. `npm run verify` (typecheck + 55 tests + build). Also `npm run build` must pass with **no env vars**.
6. **Locked reports never change.** `loadLockedClaim()` reads stored `calculations` rows; existing reports keep their figures. Only new claims pick up a methodology change. If an existing claim must reflect the change, that is an `open_revision()` with a `revision_reason`, not a recalculation.
7. PR → CI → merge to `main` → Vercel auto-deploys. Smoke-test production (password-protected) by submitting a claim and downloading the PDF.
8. Add a line to `docs/DECISIONS.md` if the change reverses or qualifies a recorded decision.

---

## Recipe: Multiplier tiers

**Defaults:** `src/lib/frv/constants.ts` → `MULTIPLIER_TIERS` (Oct 2026, approved by Lou: 1.9 / 1.8 / 1.7 / 1.6 / 1.0 for 1 / 2 / 3 / 4–11 / 12+ months). `LEGACY_MULTIPLIER_TIERS` is the original schedule; keep it, it reads old rows and anchors the reference fixtures.

**Per-claim override:** the intake form (`ClaimForm.tsx`, "Short-term multipliers" card) edits the five percentages; boundaries are fixed. The schedule travels in the payload as `multiplierTiers` (`tiersToStored`, open-ended tier `maxMonths: null`), is validated server-side by `tiersFromStored → assertValidTiers` (ascending, last open-ended, 1.00 ≤ m ≤ 5.00), used by `calculateFrv`, stored in `calculations.multiplier_tiers`, and printed via `model.ts → multiplierTable` (`tierLabel`/`markupLabel`).

- Changing a **default**: edit `MULTIPLIER_TIERS` only. Tests: `'multiplier tiers — defaults'` in `calculate.test.ts` (per-term table and the `tierLabel` test) and the defaults row in `report.test.ts`.
- Changing **boundaries** (e.g. a 4–6 month tier): edit both `MULTIPLIER_TIERS` and `LEGACY_MULTIPLIER_TIERS`' *shape* only if the form must show the new rows (the form builds its rows from `MULTIPLIER_TIERS`); stored rows keep their own shape. `tierLabel` derives labels, so no copy to update.
- Making boundaries editable too: extend the card to edit `maxMonths`, keep `assertValidTiers` as the gate.
- Fixture impact: the Coppell/Camarillo tests pass `LEGACY_MULTIPLIER_TIERS` explicitly and should not move when defaults change. If they move, the arithmetic changed.

## Recipe: Furniture rates

**File:** `constants.ts` → `FURNITURE_BY_BEDROOM` (integer cents, keyed by **loss-property** bedroom count 1–5).

- Adding a 6-bedroom rate: add the key here **and** widen the DB check `bedrooms between 1 and 5` in `supabase/migrations/` (new migration, don't edit 0001) **and** the zod `max(5)` in `claims/new/actions.ts`.
- Report furniture table is generated (`furnitureTable`); `report.test.ts → 'prints every furniture rate'` iterates the map, so it self-updates.
- Fixture impact: Coppell is 4-bed ($1,600).

## Recipe: Management fee

**File:** `constants.ts` → `DEFAULT_MANAGEMENT_FEE_CENTS` (default **$240**).

- It is a *default*: the form pre-fills it and the operator can edit per claim, including $0. The DB default lives separately in `0001_init.sql` (`mgmt_fee_cents … default 24000`) — change both or they disagree on claims created outside the form.
- To make the fee non-editable or add a fixed ASAP surcharge, that's a form change in `ClaimForm.tsx` (`loss-fee` field) plus a zod rule in `actions.ts`, not a constants change.
- Fixture impact: both fixtures use $240.

## Recipe: Comps — count and rules

**Count** — `REQUIRED_COMP_COUNT` in `constants.ts` is the engine's truth, but three other places hardcode "3" and must move together:
1. `claims/new/actions.ts` → `z.array(compSchema).length(3, …)`
2. `supabase/migrations/0001_init.sql` → `sort_position between 0 and 2` (new migration to widen)
3. Copy: `ClaimForm.tsx` ("three unfurnished comparables"), `ReportSheet.tsx`/`ReportDocument.tsx` heading "averaged across three comparables", `model.ts` compliance detail "All three listings…".
`ClaimForm.tsx` already builds its comp slots from `REQUIRED_COMP_COUNT`.

**Rules** — all in `src/lib/frv/validate.ts`, each a `check*()` returning a `ValidationEvent` with `tone: 'block' | 'warn'`:
- Geography bands → `RADIUS_BANDS` in `constants.ts` (`clean: 1`, `acceptable: 2`, `needsJustification: 5` miles; past the last → block).
- Size tolerance → `SQFT_TOLERANCE = 0.15`.
- Variance warning → `checkVariance(comps, thresholdCents = 1_500_00)`.
- Furnished detection → `FURNISHED_KEYWORDS`. Rule 1 is a hard block **and** a DB check constraint; don't soften one without the other.
- Bathrooms are **deliberately not matched** (`docs/DECISIONS.md`). Adding a bathroom check reverses a recorded decision.

A `'block'` event makes `calculateFrv()` throw `ValidationFailedError`; a `'warn'` lets it proceed and (for the 2–5 mile band) requires a written justification in the form.

## Recipe: Comp search shortlist (Find comparables)

`src/lib/listings/candidates.ts` → `DEFAULT_CRITERIA` (bedroomVariance 1, bathroomVariance 1, sqftTolerance = SQFT_TOLERANCE, radiusMiles — chosen by the operator from `SEARCH_RADIUS_STEPS` in `src/lib/frv/constants.ts`: 2.5 / 3 / 4 / 5 / 10 / 25 / 50 / 100, default 2.5; there is no automatic widening). Those are eligibility gates. **Unfurnished only:** `rental_search` can restrict to furnished but not away from it, so the search also pulls one `furnished=true` page per region and subtracts those listings before `rankCandidates` (one extra Firecrawl call per region); Rule 1's full-text check on pick remains the final gate. Past 5 miles the region strategy adds the state (ZIP + city + state, 4 pages per region, 10 total) and coverage thins. Candidates past 5 miles render with a light red hue and an "Outside 5 mi · Rule 4" chip; Use stays enabled, but Rule 4 is untouched and the engine still blocks such a comp, so it cannot lock. Changing that is `RADIUS_BANDS` in `constants.ts` and Lou's sign-off, not a picker change. The nudge ladder walks 5 → 10 → 25 → 50 → 100; at 100 the copy says it is the widest search. Order is by likeness, then distance: `scoreLikeness` weights beds exact 0.35, baths exact 0.25 (half-bath off 0.15), size closeness 0.30, single-family 0.10 — change the weights there. Never rank by rent (that steers selection; see DECISIONS.md). Apartment communities (`is_building`) are never shown. Result filters (home type, pets, available-by, exact beds/baths) are the pure `src/lib/listings/filters.ts`; tests in `tests/candidates.test.ts` and `tests/filters.test.ts`. The upstream `beds_min`/`baths_min` in `firecrawl.ts#search` derive from the same criteria.

## Recipe: Account managers ("Prepared by")

Not a methodology change and needs no sign-off; it is reference data.

- **Add or retire a name:** edit the `account_managers (name, active, sort_order)` table in Supabase. New name: insert a row with `active = true` and a `sort_order`. Retire: set `active = false`, don't delete, so names on past audit rows still resolve. No deploy; `listAccountManagers()` in `src/lib/db/account-managers.ts` loads active names on each intake load.
- **Fallback list:** `DEFAULT_ACCOUNT_MANAGERS` in `src/lib/account-managers.ts` is used when Supabase isn't configured. Keep it in step with the table when the roster changes materially. The seed in `0005_account_managers.sql` is Fazal Abed, William, Louise Jaffe.
- The server action in `claims/new/actions.ts` rejects a name not on the list. Don't loosen it to accept free text; the point is one canonical name per person in the audit trail.
- Changing the table's shape is a new migration, never an edit to `0005`.

## Recipe: Selection / averaging

`src/lib/frv/calculate.ts`. Selection is `sortHighToLow` (descending rent, position persisted as `sort_position`); output is `averageCents` of the three. Median was explicitly rejected. Changing either is a `DECISIONS.md` entry and will move both fixtures. Keep all arithmetic in integer cents via `money.ts` (`applyMultiplier`, `averageCents` — half-away-from-zero rounding).

---

## Recipe: Report headings & content blocks

The report has **one** data source and **two** renderers:

| Layer | File | What to change here |
|---|---|---|
| Content | `src/lib/report/model.ts` → `buildReportModel()` | Row labels, which rows appear, order, compliance bullets, headline caption, comp card fields. Everything arrives **pre-formatted strings**. |
| Web | `src/components/report/ReportSheet.tsx` + `.module.css` | Section `<h2>` headings, layout, which `model.*` block renders where |
| PDF | `src/components/report/ReportDocument.tsx` | Same headings/sections in react-pdf `<Text style={s.h2}>`; styles in the `s` object (Helvetica/Courier built-ins) |

- **Headings** are duplicated in `ReportSheet.tsx` and `ReportDocument.tsx` (e.g. "FRV Address Details — averaged across three comparables", "Comparables used", "12-month FRV Details", "Compliance", the two guideline table titles). Change both; `report.test.ts` does not pin headings, so grep for the old string to be sure.
- **Row labels** (e.g. "Approximate rent for the property") live once in `model.ts`; several tests pin them — update `report.test.ts` alongside.
- **Adding a block:** add a typed field to `ReportModel`, populate in `buildReportModel`, render in both renderers. Keep the Alacrity section order (Loss Address → FRV Address → 12-month → guidelines → declarations) unless Will asks otherwise — adjusters read by position.
- **Boilerplate text** (evaluation note, availability note, neutrality declaration, furniture disclaimer) is in `declarations.ts`, reproduced **verbatim** from reference reports. `report.test.ts → 'reproduces the neutrality declaration verbatim'` pins it. The amenities wording conflict is a known open item for Will — don't "fix" it silently.
- Web CSS uses design tokens from `src/app/globals.css`; no hardcoded colours in components.

## Recipe: Logo

**File:** `src/components/brand/Logo.tsx` — currently a labelled **placeholder mark**. Props `size` and `withWordmark` are used by: app header, `ReportSheet.tsx` (loss-photo fallback), and the web report header.

- **Web:** replace the SVG internals, keep the props. Prefer inline SVG with `currentColor` so it works in light/dark and on white.
- **PDF:** `ReportDocument.tsx` cannot render DOM components. It draws its own mark (see comment near line 85) and prints `Nova Havens` in `s.brandName`. Replace with react-pdf `<Svg>` primitives or `<Image src=…>` pointing at a PNG under `public/` (react-pdf `Image` needs a URL or buffer, not an import). Update both or the PDF keeps the placeholder.
- Put the asset in `public/brand/` and reference it from both renderers; drop the "placeholder mark" `aria-label` and the dashed border.
- Verify: `npm run build`, then render `/report?claim=<id>` and the PDF route locally; then production PDF — fonts/assets that work locally can be dropped by Vercel's output tracing (see `next.config.mjs → outputFileTracingIncludes`; add `./public/brand/**` there if the PDF reads from disk).

---

## Checklist before opening the PR

- [ ] Sign-off confirmed for anything in `constants.ts` or `declarations.ts`
- [ ] One source of truth changed; grep confirms no stale copy (`rg "three comparables|24000|1_500_00"`)
- [ ] Fixtures either untouched and green, or updated with hand-recomputed values stated in the PR
- [ ] `npm run verify` green; `npm run build` green with no env
- [ ] Both renderers updated for any visual change; PDF checked on **production**, not just locally
- [ ] `docs/DECISIONS.md` updated if a recorded decision changed
- [ ] PR body says what moved, why, who approved, and which fixtures changed
