import { SEARCH_RADIUS_STEPS } from '@/lib/frv';
import styles from './RadiusPicker.module.css';

/**
 * Search radius as a segmented control. The operator widens deliberately; the
 * server never does it for them.
 */
export function RadiusPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (miles: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.wrap}>
      <span id="radius-label" className={styles.label}>Search radius</span>
      <div role="radiogroup" aria-labelledby="radius-label" className={styles.group}>
        {SEARCH_RADIUS_STEPS.map((miles) => {
          const checked = miles === value;
          return (
            <button
              key={miles}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              className={`${styles.option} ${checked ? styles.selected : ''}`}
              onClick={() => onChange(miles)}
            >
              {miles} mi
            </button>
          );
        })}
      </div>
      <span className={styles.helper}>Past 5 miles is outside Rule 4 — shown for context, blocked at calculation.</span>
    </div>
  );
}
