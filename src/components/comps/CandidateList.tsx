import { formatCents } from '@/lib/frv';
import type { CompCandidate } from '@/lib/listings/types';
import { Button } from '@/components/ui/primitives';
import styles from './CandidateList.module.css';

const lower = (s: string) => s.toLowerCase().replace(/_/g, ' ');

/** Shortlist cards. Choosing one hands the candidate and slot back; the parent runs the lookup. */
export function CandidateList({
  candidates, slots, onUse, disabled = false, attribution,
}: {
  candidates: CompCandidate[];
  slots: Array<{ filled: boolean }>;
  onUse: (candidate: CompCandidate, slot: number) => void;
  disabled?: boolean;
  attribution: string | null;
}) {
  const anyExtended = candidates.some((c) => c.band === 'extended' || c.band === 'beyond-limit');
  return (
    <>
      <ul className={styles.candidates} aria-label="Comparable candidates">
        {candidates.map((c) => (
          <li key={c.zpid} className={`${styles.candidate} ${c.band === 'extended' || c.band === 'beyond-limit' ? styles.beyond : ''}`}>
            <div className={styles.main}>
              <p className={styles.address}>
                <a href={c.url} target="_blank" rel="noreferrer">{c.address}</a>
                <span className={`${styles.chip} ${c.match === 'exact' ? styles.exact : styles.close}`}>
                  {c.match === 'exact' ? 'Exact match' : 'Close match'}
                </span>
                {c.band === 'extended' || c.band === 'beyond-limit' ? (
                  <span className={`${styles.chip} ${styles.bandBlock}`}>
                    {c.distanceMiles.toFixed(1)} mi · Past 5 mi
                  </span>
                ) : (
                  <span className={`${styles.chip} ${c.band === 'needs-justification' ? styles.bandWarn : styles.bandPass}`}>
                    {c.distanceMiles.toFixed(1)} mi{c.band === 'needs-justification' ? ' · needs justification' : ''}
                  </span>
                )}
              </p>
              <p className={styles.meta}>
                {formatCents(c.rentCents)}/mo · {c.bedrooms} bd · {c.bathrooms} ba · {c.sqft.toLocaleString()} sq ft
                {c.homeType ? ` · ${lower(c.homeType)}` : ''}
              </p>
              {(c.pets.length > 0 || c.availableFrom) && (
                <p className={styles.extra}>
                  {c.pets.length > 0 && <>Pets: {c.pets.join(', ')}</>}
                  {c.pets.length > 0 && c.availableFrom && ' · '}
                  {c.availableFrom && <>Available {c.availableFrom}</>}
                </p>
              )}
            </div>
            <div className={styles.actions}>
              {slots.map((slot, i) => (
                <Button key={i} type="button" size="sm" variant="ghost" onClick={() => onUse(c, i)} disabled={disabled}>
                  {slot.filled ? `Replace ${i + 1}` : `Use as ${i + 1}`}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {anyExtended && (
        <p className={styles.legend}>
          Red cards are past 5 miles. They can be used up to 100 miles; the distance is printed on the report.
        </p>
      )}
      {attribution &&<p className={styles.attribution}>{attribution}</p>}
    </>
  );
}
