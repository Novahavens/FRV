import type { CompCandidate } from './candidates';
import type { CandidateFilter } from './types';

/**
 * Operator-side narrowing of a shortlist. Pure and client-safe: no server-only
 * imports, so the browser can filter instantly without another search.
 */
export function isEmptyFilter(f: CandidateFilter): boolean {
  return f.homeTypes.length === 0 && f.pets.length === 0 && f.availableBy == null && !f.exactBeds && !f.exactBaths;
}

export function filterCandidates(
  candidates: CompCandidate[],
  filter: CandidateFilter,
  loss: { bedrooms: number; bathrooms: number },
): CompCandidate[] {
  return candidates.filter((c) => {
    if (filter.homeTypes.length && !(c.homeType && filter.homeTypes.includes(c.homeType))) return false;
    if (filter.pets.length && !filter.pets.every((p) => c.pets.includes(p.toLowerCase()))) return false;
    // A listing with no stated date is kept: unknown is not "too late".
    if (filter.availableBy && c.availableFrom && c.availableFrom.slice(0, 10) > filter.availableBy) return false;
    if (filter.exactBeds && c.bedrooms !== loss.bedrooms) return false;
    if (filter.exactBaths && c.bathrooms !== loss.bathrooms) return false;
    return true;
  });
}

/** Distinct, sorted values present, so the UI only offers filters that would do something. */
export function filterOptions(candidates: CompCandidate[]): { homeTypes: string[]; pets: string[] } {
  const homeTypes = new Set<string>();
  const pets = new Set<string>();
  for (const c of candidates) {
    if (c.homeType) homeTypes.add(c.homeType);
    for (const p of c.pets) pets.add(p);
  }
  return { homeTypes: [...homeTypes].sort(), pets: [...pets].sort() };
}
