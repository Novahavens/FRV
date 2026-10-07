# Decision log

Choices that look odd from the outside, recorded so nobody re-litigates them in six months without the context that settled them.

---

## Three comps, averaged — selected high to low

The reference guide says sort Zillow high to low and take the top comp. The build decision says average three, matching MyKey. A third document suggested median.

These are two decisions, not one. **Selection** sorts by rent descending and takes the top three defensible matches — that preserves why high-to-low exists: the FRV is a ceiling, and a higher defensible ceiling gives the account manager room to place someone. **Output** averages those three, which is more defensible to a carrier than a single top-of-market listing that invites a revision fight.

Median is rejected. With three data points it discards two of them.

## Bathrooms are not matched

Bedroom count is enforced; bathroom count is not. In the walkthrough, a 4-bed/2.5-bath comp was correctly used for a 3-bed/3-bath loss because square footage and location mattered more. Filtering on bathrooms narrows the pool without improving the comp.

This looks like a bug. It is not.

## Money is integer cents

Floating-point dollars accumulate error across a multiply-then-average chain. This number is the ceiling on someone's housing for months and must reproduce exactly from stored data, years later. Dollars exist only at parse and format.

Rounding is half away from zero, not banker's rounding. An adjuster will check the arithmetic on a calculator; match what a person gets by hand.

## The lock lives in Postgres

Rule 5 is enforced by triggers on `claims`, `comps` and `calculations`, not by hiding controls in the interface. A hidden button is a suggestion; a rejected write is a guarantee — against the app, a script, or someone in the Supabase dashboard.

`open_revision()` is the only route through. It sets a transaction-scoped flag that dies on commit, writes a reason-coded revision row, and reopens the claim at the next version. There is no way to hold the window open.

## Reports render from stored figures

`loadLockedClaim()` reads the `calculations` row and does not run the engine. If the arithmetic ever changes, every report already in an adjuster's file stays exactly as it was accepted.

## Validation throws rather than warns

`calculateFrv` re-runs validation and throws on any blocking rule. A number with a caveat attached does not stop someone sourcing against it; an exception does.

## Multipliers are editable per claim; defaults are +25% (October 2026)

Approved by Lou, October 2026. Two changes, recorded together:

1. **The default schedule moved.** Every markup is 25% higher than the original: 1–2 months 50% (was 40), 3–5 months 37.5% (was 30), 6–9 months 31.25% (was 25), 10–11 months 12.5% (was 10). Twelve months and beyond stays at no markup.
2. **The schedule is an input, not a constant.** The intake form shows the five tiers as editable percentages, pre-filled with the defaults. Whatever the operator enters is used for the live figure, recomputed on the server, **stored with the calculation** (`calculations.multiplier_tiers`) and printed on the report's guideline table. Tier boundaries are fixed; the percentages are not. Multipliers below 1.00 are rejected — a markdown is not a short-term premium.

Why store the schedule rather than reference the constants: a locked report must keep printing the table its figure was built from, however the defaults move afterwards. Rows written before this change carry no schedule and are read with the legacy one.

**The Coppell and Camarillo reference figures are no longer acceptance gates.** They remain in the suite as arithmetic regressions *under the legacy schedule*, which they pass to the cent. The suite now also asserts the defaults are exactly +25% on the legacy schedule, and that a custom schedule flows through to the figure and the report.

## Comp search is a shortlist, never a selection (October 2026)

The original decision below excluded `rental_search` outright. That was revisited and approved by Will and Lou in October 2026 on these terms:

- **Suggest, human picks.** "Find comparables" shows active rentals near the loss that fit it — bedrooms ±1, bathrooms ±1, square footage ±15%, within two miles, widening to five only when fewer than six are found inside two. Apartment communities are excluded; nothing past five miles is ever shown.
- **Closest first, never highest rent first.** Ordering by rent would steer selection. High-to-low sorting happens *after* the human has chosen, as it always did.
- **Picking a candidate is pasting its URL.** It runs the same single-listing lookup, so Rule 1 reads the full listing text, every field remains editable, and the audit trail is identical to a hand-pasted comp.
- **Nothing is written to a claim by the search.** It populates a list on screen and nothing else.

What this is not: automatic comp selection. The PRD's reason for excluding discovery — geography is where FRVs go wrong — still holds, which is why the shortlist is filtered by the engine's own radius bands and the final choice is a person's.

Ordering and radius were revised in October 2026 — see "Find comps: likeness first, radius is the operator's choice" below.

## Listing data comes through Firecrawl — narrowly

Zillow retired its public API in September 2021. Its partner programme, Bridge Interactive, requires MLS membership. Commercial "Zillow APIs" are scraper wrappers.

Will and Lou approved Firecrawl's catalogued Zillow capability in October 2026, on these terms:

- `properties/rental` only — metadata for a listing the account manager already chose
- `rental_search` was excluded at the time; see the entry above for the October 2026 revision that admits it as a shortlist
- every field editable, overrides recorded
- expired listings refused
- Zillow's attribution printed on any report built from its data

Tested live on 1 October 2026: sixteen active Coppell rentals returned with rent, beds, baths, square footage and coordinates. The April reference comp returned 404 — listings expire, which is the strongest argument for rendering reports from stored figures.

## One page, live figure

The account manager sees the FRV change as they type, and submit is the only state change. A stepped wizard hides the consequence of each input until the end; this shows it immediately.

## The report follows Alacrity's anatomy

Carriers already read Alacrity reports. Matching their section structure — Loss Address Details, FRV Address Details, 12-month FRV Details — means an adjuster finds each number where they expect it. The methodology underneath is Nova Havens': three comps averaged, both totals preserved, and a test asserting the totals reconcile.

## Known wording conflict

The evaluation note, reproduced verbatim from the reference reports, says amenities "have been taken into consideration". The tool excludes amenity fields entirely. This is flagged in `src/lib/report/declarations.ts` and open with Will. Until it is answered, the text stays as the reference reports have it.

## Default multipliers are 90 / 80 / 70 / 60 by month (October 2026)

Approved by Lou, October 2026. Supersedes the "+25% on every markup" defaults recorded above; the *per-claim editability* from that entry is unchanged.

| Approved term | Markup | Multiplier |
|:--|--:|--:|
| 1 month | 90% | 1.90 |
| 2 months | 80% | 1.80 |
| 3 months | 70% | 1.70 |
| 4–11 months | 60% | 1.60 |
| 12+ months | none | 1.00 |

Two things changed, not one: the markups, and the **tier boundaries** (the old schedule banded 1–2, 3–5, 6–9, 10–11). Still five tiers, so the form and the report table keep their shape. The 12+ month tier is editable like the others — a claim may carry a markup there if a carrier agrees one.

What did not change: `LEGACY_MULTIPLIER_TIERS` (the pre-October schedule) still reads calculations stored without a schedule, and the Coppell ($6,448.50) and Camarillo ($10,145) fixtures still run under it as arithmetic regressions. Locked reports keep the schedule they were built from, as always. Only new claims see the new defaults.

## Comp search stays Zillow-only; Furnished Finder declined (October 2026)

A second concurrent search source was proposed for *Find comparables*, with Furnished Finder named. Declined, for two reasons that each suffice:

1. **Rule 1.** Furnished Finder's inventory is furnished mid-term housing. A furnished listing is blocked by the engine and cannot even be stored (`check (furnished = false)`), so a shortlist from it would be a shortlist of comps that can never be used. Showing it would only invite the override Rule 1 forbids.
2. **No capability.** Firecrawl's catalogue has no Furnished Finder provider. The other catalogued rental searches (Redfin `properties/search`, Craigslist `housing/search`) return neither reliable coordinates nor square footage, both of which `rankCandidates` requires.

If a second *unfurnished* source with coordinates and square footage becomes available, it belongs behind the same `ListingProvider` interface and the same `rankCandidates` filter, run concurrently with Zillow and merged closest-first. Nothing in the form would change.

## The report carries imagery: Street View and an aerial map (October 2026)

Requested by Fazal, October 2026. This qualifies the original "no maps" exclusion, which was about *comp discovery by map* — an interactive map on the intake form that would steer selection. That exclusion stands. What is added is **static imagery on the finished report**, after the figure is locked:

- **Street View** of the loss address in the loss-card photo slot (the house placeholder remains the fallback when there is no coverage).
- **A hybrid aerial map** beside the headline figure: the loss address as a red "L" pin, the three comparables as pins 1–3 in their persisted high-to-low order. It shows the adjuster the geography Rule 4 was applied to; it does not change any figure.

Terms of the implementation:

- **Server-only key.** `GOOGLE_MAPS_SERVER_KEY` is read only on the server. The web report loads images through the app's own routes (`/api/claims/[id]/street-view`, `/api/claims/[id]/map`); the PDF route fetches the bytes directly. The key never appears in HTML, image URLs or error responses.
- **Fetched on render, not stored.** Coordinates are already persisted, so the pins cannot move; only the imagery can age. Storing the images was considered and declined — it needs a bucket, a migration and a lock-time upload, and Google's terms limit caching of imagery.
- **Optional.** Without the key, the report renders exactly as before. The build passes with no env vars.
- **Report only.** Not on the intake form, where a map would do the thing the original decision guards against.
- **One page.** The map sits in the hero row at the loss card's height, so the PDF stays a single A4 page.

## Find comps: likeness first, radius is the operator's choice (October 2026)

Fazal, 7 October 2026. Revises the ordering and radius terms of "Comp search is a shortlist, never a selection".

**What changed**

- **Radius is the operator's choice.** *Find comps* searches 2.5 miles by default. An always-visible picker offers 2.5 / 3 / 4 / 5 miles (`SEARCH_RADIUS_STEPS`). The automatic widening (two miles, widen to five when fewer than six) is removed. Five is the cap because Rule 4 blocks anything further.
- **Widening is a deliberate click, because it costs something.** Zillow's search is region-based (ZIP or city, no radius). Up to 2.5 miles searches the ZIP (2 pages). 3–5 miles searches ZIP and city: more pages, more Firecrawl credits, slower. Distance is then filtered by Haversine.
- **Likeness over distance.** Eligibility gates are unchanged: bedrooms ±1, bathrooms ±1, size ±15%, no apartment communities, active only, inside the radius. Within the eligible set, candidates are ranked by a likeness score: beds exact 0.35, baths exact 0.25 (half-bath off 0.15), size closeness 0.30, single-family 0.10. Distance breaks ties. Cards say "Exact match" (beds and baths equal, size within 5%) or "Close match".
- **Busy state.** A searching panel shows a spinner, the radius, elapsed time and "please be patient" copy. Controls lock while it runs.
- **Thin or empty results** suggest the next radius and searching again. At 5 miles they suggest pasting listing URLs by hand.
- **Filter results.** Home type, pets allowed, available-by date, exact beds, exact baths. Deliberately not called "Amenities": these are facts Zillow's search records already carry, so filtering is instant and free.

**Why**

Closest-first put a small, distant-in-character house ahead of a near-identical one a little further out. An adjuster reads the comp for likeness to the loss; distance already has its own gate in Rule 4. Automatic widening spent credits and time on every thin search without the operator knowing. Rent was never the problem and stays out.

The recorded rule becomes: **most like the loss first, closest as tiebreaker, never rent.** Ranking by rent would steer selection, so rent is still not a ranking input. High-to-low sorting happens after the human has chosen, as before.

**What did not change**

- Eligibility gates, the five-mile cap and Rule 4 bands.
- Picking a candidate is pasting its URL: same `lookup`, same Rule 1, same audit trail.
- The search writes nothing to a claim.
- No amenity fields on the claim, the engine or the report. "No amenity fields" stands.

**What this is not**

- Not amenity matching. Garage, pool, laundry, A/C and yard are not in search records. Fetching the detail listing for every candidate costs 5 credits each; considered and declined.
- Not automatic selection. The score orders a list; a person still chooses.
- Not a ranking by rent, and not a change to the FRV arithmetic.

## Prepared by is a list, not a text field (October 2026)

Fazal, 7 October 2026. *Prepared by* was free text. It is now a dropdown of account managers.

**Why**

*Prepared by* writes to every audit row until authentication lands. A free-text name drifts: "Fazal", "Fazal A.", "fazal abed" are three people to a query and to an adjuster reading the trail. An audit row needs one canonical name per person.

**How**

- The list lives in a table, `account_managers (name, active, sort_order)` (migration `0005_account_managers.sql`), so a name can be added or retired without a deploy. Retiring sets `active = false`; the row stays, so the name on past audit rows still resolves.
- `listAccountManagers()` in `src/lib/db/account-managers.ts` loads the active names. The server action rejects any name not on the list, so the dropdown is not the only guard.
- Without Supabase the form falls back to `DEFAULT_ACCOUNT_MANAGERS` in `src/lib/account-managers.ts`, the same way the app falls back to the demo claim. Seeded with Fazal Abed, William and Louise Jaffe.

**What this is not**

Not authentication. Anyone can still pick any name; the list makes the name canonical, not proven. Login remains deferred.

## Find comps: unfurnished only, radius to 100 miles, Rule 4 unchanged (October 2026)

Fazal, 7 October 2026. Two changes to *Find comps*, recorded together. Revises the radius terms of "Find comps: likeness first, radius is the operator's choice" and the "nothing past five miles is ever shown" line in "Comp search is a shortlist, never a selection".

**Unfurnished homes only**

Zillow's `rental_search` can restrict *to* furnished listings but not away from them. So each search also pulls one `furnished=true` page per region and subtracts those listings before ranking. Cost: one extra Firecrawl call per region.

Why subtract rather than show and let Rule 1 catch it: a shortlist full of furnished homes is a shortlist of comps that can never be stored. Showing them invites the override Rule 1 forbids and wastes the operator's picks. The subtraction is best-effort, since it removes only what one page of furnished results contains. **Rule 1's full-text check on pick remains the final gate**, and `check (furnished = false)` still backs it.

**Radius picker to 100 miles**

`SEARCH_RADIUS_STEPS` is now 2.5 / 3 / 4 / 5 / 10 / 25 / 50 / 100. Past 5 miles the region strategy adds the state (ZIP + city + state; 4 pages per region, 10 in total). Zillow has no radius search, so coverage thins as the radius grows; 100 miles is the widest search, not a complete one. The nudge ladder for thin results walks 5 → 10 → 25 → 50 → 100, and at 100 the copy says so.

Why the picker goes past Rule 4: the operator knows the market. A loss in a small town may have no defensible comp inside five miles, and the operator should see what exists rather than be told nothing does. Candidates past 5 miles are shown with a light red hue and an "Outside 5 mi · Rule 4" chip. The Use button stays enabled, because the cue is for the operator, not a second gate.

**What did not change**

- **Rule 4.** The bands and the block are untouched. The engine still halts at calculation for a comp past 5 miles, so such a comp can be picked and filled but cannot lock. The form says why.
- Eligibility gates (bedrooms ±1, bathrooms ±1, size ±15%, no buildings, active only), likeness ordering, never rent.
- Picking runs the same `lookup`; the search writes nothing to a claim.

**What this is not**

Not a lift of the 5-mile rule. Whether comps beyond five miles should ever be allowed to lock is a methodology decision for Lou, and it has not been made. If it is, it is a change to `RADIUS_BANDS` in `constants.ts` and a new entry here, not a change to the picker.
