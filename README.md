<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/hero-dark.svg">
  <img alt="FRV — three comparables averaged to a ceiling of $6,448.50" src="docs/assets/hero-light.svg" width="100%">
</picture>

<br>

# FRV

**The monthly housing ceiling on an insurance claim — calculated once, defended forever.**

<p>
  <a href="https://github.com/Novahavens/FRV/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Novahavens/FRV/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Deployed on Vercel" src="https://img.shields.io/badge/Vercel-production-000000?style=flat-square&logo=vercel&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-55%20passing-05803b?style=flat-square&logo=vitest&logoColor=white">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-0a0a0a?style=flat-square&logo=nextdotjs">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-20232a?style=flat-square&logo=react&logoColor=61dafb">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-276ef1?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20triggers-05803b?style=flat-square&logo=supabase&logoColor=white">
</p>

<p>
  <a href="#the-number">The number</a> ·
  <a href="#see-it">See it</a> ·
  <a href="#how-a-claim-moves">How a claim moves</a> ·
  <a href="#the-five-rules">The five rules</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#deploying">Deploying</a> ·
  <a href="#working-with-claude-code">Claude Code</a>
</p>

</div>

---

When a home becomes uninhabitable, a policy's Additional Living Expenses coverage pays for somewhere else to live. The **Fair Rental Value** is the monthly ceiling on that spend. Carriers don't calculate it themselves — setting a number you have a financial interest in keeping low is a lawsuit — so they hand it to a neutral third party.

That third party is Nova Havens. **This is the tool that produces the number.**

An account manager enters the loss property, pastes three Zillow listings, and receives a single-page report an adjuster can approve without picking up the phone. Every rule in the methodology is enforced by the software, the arithmetic is reproducible to the cent from stored data alone, and once the figure locks, **the database itself refuses to let it move.**

<br>

## The number

```
FRV  =  (base comp rent × short-term multiplier)  +  furniture  +  management fee
```

Applied to each of three unfurnished comparables, sorted high to low, then **averaged**.

<table>
<tr><td valign="top">

| Approved term | Default multiplier |
|:--|--:|
| 1 – 2 months | × 1.50 |
| 3 – 5 months | × 1.375 |
| 6 – 9 months | × 1.3125 |
| 10 – 11 months | × 1.125 |
| 12 months | × 1.00 |

<sub>Defaults. Editable per claim; the schedule used is stored and printed.</sub>

</td><td valign="top">

| Bedrooms | Furniture / month |
|:--|--:|
| 1 | $1,059 |
| 2 | $1,267 |
| 3 | $1,456 |
| 4 | $1,600 |
| 5 | $1,746 |

</td><td valign="top">

| Reference claim | FRV |
|:--|--:|
| Coppell, TX · 3 comps · 3 mo | **$6,448.50** |
| Camarillo, CA · 2 mo | **$10,145** |

Under the original schedule, as the PRD reports were.<br>Kept as arithmetic regressions.

</td></tr>
</table>

Management fee defaults to **$240**, is editable per claim, and accepts zero. Multipliers are editable per claim too: the intake form shows the five tiers as percentages, pre-filled with the defaults above (approved by Lou, October 2026 — every markup 25% higher than the original schedule). Whatever is entered is recomputed on the server, stored with the calculation and printed on the report, so the workings an adjuster checks always match the figure.

<br>

## See it

<table>
<tr>
<th align="center">Intake — one page, live figure</th>
<th align="center">Report — web preview and PDF from one model</th>
</tr>
<tr>
<td width="50%" valign="top"><img alt="Intake form with the FRV updating live as comps are entered" src="docs/assets/intake-preview.png"></td>
<td width="50%" valign="top"><img alt="Final FRV report for the Coppell reference claim" src="docs/assets/report-preview.png"></td>
</tr>
<tr>
<td><sub>The figure updates as you type. Submit is the only state change.</sub></td>
<td><sub>Section order follows the Alacrity format adjusters already read. The PDF is the same model, rendered server-side.</sub></td>
</tr>
</table>

<br>

## How a claim moves

```mermaid
flowchart LR
    A[Loss property<br/><sub>address · beds · baths · sqft · term</sub>] --> B[Three comps<br/><sub>paste Zillow URLs</sub>]
    B --> V{Validate}
    V -- furnished, or past 5 miles --> X[Blocked<br/><sub>replace the comp</sub>]
    V -- 2 to 5 miles, size or bedroom drift --> J[Justify in writing]
    J --> C
    V -- clean --> C[Calculate<br/><sub>live, in the browser</sub>]
    C --> L[Submit and lock<br/><sub>server recomputes, Postgres freezes it</sub>]
    L --> R[Report<br/><sub>web preview + PDF</sub>]
    L --> S[Sourcing opens]

    style X fill:#fdecec,stroke:#c81e1e,color:#a11414
    style J fill:#fdf2e5,stroke:#b25e09,color:#8a4708
    style L fill:#efedfb,stroke:#5b4cc4,color:#443790
    style S fill:#e8f6ee,stroke:#05803b,color:#046130
```

<br>

## The five rules

These lived in a reference guide as advice for people. Here they are system behaviour, because a rule that is only documented is a rule that gets skipped at 4pm on a Friday.

| | Rule | Enforced by | When it fails |
|:-:|:--|:--|:--|
| **1** | Unfurnished comps only | Furnished flag and listing-text keyword scan in the engine, plus a `check` constraint so a furnished comp cannot even be stored | Rejected. No override exists, at any permission level. |
| **2** | FRV before sourcing | `sourcing_unlocked` is set only by the lock transition | Sourcing stays closed |
| **3** | Sort high to low | `sort_position` persisted with the record, never recomputed at render | Re-sorted; entry order kept in the audit trail |
| **4** | Geography over everything | Haversine bands from coordinates captured at intake: <1 mi, 1–2 mi, 2–5 mi needs justification, >5 mi halts | Past five miles the calculation stops rather than widening |
| **5** | Locked once set | Postgres triggers on `claims`, `comps` and `calculations`; `open_revision()` is the only way through | A new immutable version plus a reason-coded revision record |

Bedroom count is enforced. **Bathroom count deliberately is not** — a 4-bed/2.5-bath comp was correctly used for a 3-bed/3-bath loss because square footage and location mattered more. See [the decision log](docs/DECISIONS.md#bathrooms-are-not-matched).

<br>

## Architecture

```mermaid
flowchart TB
    subgraph browser [Browser]
        F[ClaimForm] -->|same engine| E1[lib/frv]
    end
    subgraph server [Next.js server]
        A[Server action] -->|recomputes| E2[lib/frv]
        A --> DB[(Supabase Postgres)]
        R[Report route] -->|stored figures only| DB
        R --> PDF[react-pdf]
    end
    F -- submit --> A
    FC[Firecrawl · Zillow] -. fills fields .-> F
    GEO[US Census geocoder] -. coordinates .-> F
    DB -- lock triggers --> DB

    style E1 fill:#efedfb,stroke:#5b4cc4
    style E2 fill:#efedfb,stroke:#5b4cc4
    style DB fill:#e8f6ee,stroke:#05803b
```

```
src/
├── lib/
│   ├── frv/            Pure calculation core. No I/O, no framework, no network.
│   │   ├── constants.ts    The locked methodology — changing a value here needs Lou
│   │   ├── money.ts        Integer-cent arithmetic and formatting
│   │   ├── geo.ts          Haversine distance and radius bands
│   │   ├── multiplier.ts   Term tiers and furniture rates
│   │   ├── validate.ts     The rules as executable checks
│   │   ├── calculate.ts    Selection (high-to-low) and output (three-comp average)
│   │   └── listing-url.ts  Zillow URL → street address
│   ├── listings/       Listing metadata providers, behind one interface
│   ├── report/         Report view-model and verbatim declarations
│   ├── db/             Supabase access — the only layer that knows about storage
│   └── env.ts          Environment, validated once
├── components/         UI bound to design tokens. No hardcoded colour anywhere.
└── app/
    ├── claims/new/     Intake: one page, live figure, server actions
    ├── report/         On-screen report
    └── api/            PDF rendering, health check

supabase/   Schema, lock triggers, open_revision(), seed
tests/      Acceptance fixtures against the PRD reference reports
docs/       Decision log, assets
```

Four ideas carry the whole design.

> **The core is a pure island.** Nothing from React, Next or Supabase reaches into `lib/frv`. That is what makes the fixtures meaningful, and it is why the browser can run the exact code the server runs — the live preview isn't an approximation of the answer, it *is* the answer. The server recomputes on submit regardless; a figure that reaches an adjuster must not have been produced on a machine we don't control.

> **Money is integer cents.** Dollars exist only at parse and format. A multiply-then-average chain in floating point accumulates error, and this number is the ceiling on someone's housing for months.

> **The lock is a database trigger, not a hidden button.** Hiding a control is a suggestion; a rejected write is a guarantee. It holds against the app, a script, and the Supabase dashboard alike.

> **Reports render from stored figures.** `loadLockedClaim()` reads the `calculations` row and never consults the engine, so a future change to the arithmetic cannot restate a report an adjuster has already accepted. One view-model feeds both the web preview and the PDF; layout may differ between them, content cannot.

<br>

## Listing data

Paste a Zillow listing URL and the comp fills itself: rent, bedrooms, bathrooms, square footage, coordinates.

This runs through **Firecrawl's catalogued Zillow capability**, approved by Will and Lou in October 2026. Its scope is deliberately narrow:

- **`properties/rental`** — metadata for the one listing the account manager chose.
- **`properties/rental_search`** — *Find comparables*: a shortlist of active rentals near the loss that fit it (bedrooms ±1, bathrooms ±1, size ±15%, within two miles, widening to five only when the near set is thin). Closest first, never highest rent first. The account manager picks; picking runs the single-listing lookup so every rule still applies. Comp selection stays human because geography is where FRVs go wrong, and no tool reliably tells one side of a boundary road from the other.
- **Every field stays editable**, and the audit trail records which ones the operator changed. The lookup saves typing; it is never the source of truth.
- **Expired listings are refused.** A comp that is no longer for rent is not evidence.
- **The data remains Zillow's.** Records carry an attribution string, and any report built from them prints it.

Zillow itself has offered no public API since September 2021, and its partner programme requires MLS membership. Lookup runs when `FIRECRAWL_API_KEY` is set; without it the form works identically with manual entry. A licensed provider can replace Firecrawl by implementing `ListingProvider` without touching the form, the engine or the report.

<br>

## The report

Section structure follows the Alacrity format carriers already receive — Loss Address Details, FRV Address Details, 12-month FRV Details, guideline tables, neutrality declaration — so an adjuster finds every number where they always have. Underneath, it's Nova Havens' methodology: three comps averaged where Alacrity carries one, with both of their totals preserved and a test asserting they reconcile.

The guideline tables on the page are generated from the same constants the engine reads. The workings an adjuster checks can never disagree with the arithmetic that produced the figure above them.

`GET /api/claims/:id/report` returns the PDF. It renders only for locked claims, from stored figures, and is never cached.

<br>

## Quick start

```bash
git clone https://github.com/Novahavens/FRV.git && cd FRV
cp .env.example .env.local
npm ci
npm run dev
```

Without Supabase configured, the app renders the Coppell reference claim and says so on screen. An unlabelled sample that looks real is how someone emails a fake FRV to an adjuster.

| Variable | Purpose |
|:--|:--|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. A new-style `sb_secret_…` key works here |
| `FIRECRAWL_API_KEY` | Optional. Empty means manual comp entry |

To run against a real database:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f supabase/seed.sql      # optional reference claim
```

| Command | Does |
|:--|:--|
| `npm run dev` | Local server at `localhost:3000` |
| `npm test` | Acceptance fixtures and unit tests |
| `npx vitest run -t "Coppell"` | Just the tests matching a name |
| `npm run typecheck` | Strict TypeScript, `noUncheckedIndexedAccess` on |
| `npm run verify` | Typecheck, test and production build — the pre-push gate |

<br>

## Deploying

Vercel, Node runtime, auto-deploys from `main`. Set the three variables above, then point the deploy gate at **`GET /api/health`** — it checks configuration and database reachability, and returns `503` until both are sound. Environment is validated in `src/lib/env.ts`, so a missing key fails at boot, not when someone hits submit.

Production sits behind Vercel **password protection** rather than Vercel SSO, so account managers without Vercel seats can use it until application auth lands.

<details>
<summary><strong>Two things that only break on Vercel</strong></summary>
<br>

- **PDF fonts.** pdfkit requires its built-in fonts with a dynamic `require` that output tracing cannot see. `next.config.mjs` ships them explicitly via `outputFileTracingIncludes`; without it the PDF route fails with `Cannot find module …/standard-fonts/Helvetica.cjs` — on Vercel only, never locally.
- **Hydration.** The intake form is server-rendered, then hydrated. Automated tests must wait for hydration before typing or React resets the inputs.

</details>

<br>

## Database

| Migration | What it does |
|:--|:--|
| `0001_init.sql` | Schema, `check (furnished = false)`, lock triggers, `open_revision()`, RLS |
| `0002_pin_function_search_path.sql` | Pins `search_path` on every function (Supabase lint 0011) |
| `0003_fix_claims_guard_return_on_delete.sql` | BEFORE DELETE triggers must return `OLD`, not `NEW` |
| `0004_calculations_multiplier_tiers.sql` | Stores the multiplier schedule each calculation used |

`open_revision(claim_id, reason, actor, note)` is the one sanctioned route through the lock. It sets a transaction-scoped flag, writes a reason-coded `revisions` row, and reopens the claim at the next version. There is no way to hold the window open.

<br>

## Working with Claude Code

This repo is set up for [Claude Code](https://claude.ai/code):

| | |
|:--|:--|
| [`CLAUDE.md`](CLAUDE.md) | Commands, the cross-file architecture, decisions that look like bugs, deploy gotchas |
| [`/frv`](.claude/skills/frv/SKILL.md) | Operational checklist and hard-won learnings |
| [`/frvcalcupdate`](.claude/skills/frvcalcupdate/SKILL.md) | Recipes for changing multipliers, fees, comp rules, report headings, content blocks and the logo — with the sign-off protocol and which fixtures each change moves |

<br>

## Status

| | |
|:--|:--|
| ✅ | Calculation core, validation, fixtures |
| ✅ | Schema with trigger-enforced locking and `open_revision()` |
| ✅ | One-page intake with live figure, editable multiplier schedule, Firecrawl listing lookup and *Find comparables* shortlist |
| ✅ | Report — web preview and PDF from one view-model, with attribution |
| ✅ | Stored-figure reads, seed data, health check, env validation |
| ✅ | Deployed to Vercel, verified end to end in production |
| ◻️ | Revision flow UI |
| ◻️ | Claim list |
| ◻️ | Authentication — deferred; *Prepared by* writes to every audit row until then |
| ◻️ | Real logo — the mark in use is a labelled placeholder |

## Not built, on purpose

No comp discovery. No maps. No amenity fields. No market-value input. No insured-facing views — the insured never sees the FRV.

Choices that look odd from the outside are recorded in [`docs/DECISIONS.md`](docs/DECISIONS.md) so nobody re-litigates them in six months without the context that settled them.

---

<div align="center">
<sub>Internal to Nova Havens. Methodology in <code>src/lib/frv/constants.ts</code> reflects decisions by Lou and requires her sign-off to change.</sub>
</div>
