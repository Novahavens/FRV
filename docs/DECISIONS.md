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

## Listing data comes through Firecrawl — narrowly

Zillow retired its public API in September 2021. Its partner programme, Bridge Interactive, requires MLS membership. Commercial "Zillow APIs" are scraper wrappers.

Will and Lou approved Firecrawl's catalogued Zillow capability in October 2026, on these terms:

- `properties/rental` only — metadata for a listing the account manager already chose
- never `rental_search`, which is comp discovery and excluded by FR-2
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
