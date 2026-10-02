/**
 * Turn a listing URL the account manager pasted into a street address.
 *
 * There is no public Zillow API and scraper wrappers are out of scope, so the
 * flow is: the operator searches Zillow themselves, pastes the URL, and the
 * address parsed out of it is handed to a licensed metadata provider. Zillow
 * stays the search tool; it is never the data source.
 */
export interface ParsedListing {
  address: string | null;
  zpid: string | null;
  source: 'zillow' | 'unknown';
}

const ZILLOW_DETAIL = /zillow\.com\/homedetails\/([^/]+)\/(\d+)_zpid/i;

export function parseListingUrl(raw: string): ParsedListing {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { address: null, zpid: null, source: 'unknown' };
  }

  const match = ZILLOW_DETAIL.exec(url.href);
  if (!match?.[1]) return { address: null, zpid: null, source: 'unknown' };

  // "1052-Village-Pkwy-Coppell-TX-75019" → "1052 Village Pkwy, Coppell, TX 75019"
  const parts = decodeURIComponent(match[1]).split('-');
  const zip = parts.at(-1);
  const state = parts.at(-2);
  const city = parts.at(-3);
  const street = parts.slice(0, -3).join(' ');

  if (!zip || !state || !city || !street) {
    return { address: null, zpid: match[2] ?? null, source: 'zillow' };
  }

  return {
    address: `${street}, ${city}, ${state} ${zip}`,
    zpid: match[2] ?? null,
    source: 'zillow',
  };
}
