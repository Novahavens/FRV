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
