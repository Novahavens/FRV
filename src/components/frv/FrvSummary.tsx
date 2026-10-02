import { formatCents } from '@/lib/frv';
import type { Calculation } from '@/lib/frv';
import { LockBadge } from '@/components/ui/primitives';
import { CeilingChart } from './CeilingChart';
import styles from './FrvSummary.module.css';

/**
 * The figure and its workings.
 *
 * The breakdown is not optional. A bare total invites a revision request, and a
 * revision fight costs more than the eighty pixels the workings take up.
 */
export function FrvSummary({
  calculation,
  locked = false,
  version,
}: {
  calculation: Calculation;
  locked?: boolean;
  version?: number;
}) {
  const rows: Array<[string, string]> = [
    ['Averaged base rent', formatCents(calculation.averagedBaseRentCents)],
    [`Adjusted rent (×${calculation.multiplier.toFixed(2)})`, formatCents(calculation.averagedAdjustedRentCents)],
    ['Furniture, housewares, appliances', formatCents(calculation.furnitureCents)],
    ['Management fee', formatCents(calculation.managementFeeCents)],
    ['Parallel 12-month figure', formatCents(calculation.twelveMonthCents)],
  ];

  return (
    <section className={`${styles.card} ${locked ? styles.locked : ''}`} aria-labelledby="frv-heading">
      <header className={styles.head}>
        <h2 id="frv-heading" className={styles.heading}>Averaged Fair Rental Value</h2>
        {locked && <LockBadge label={version && version > 1 ? 'Revised' : 'Locked'} version={version} />}
      </header>

      <p className={`${styles.figure} mono`}>{formatCents(calculation.averagedFrvCents)}</p>
      <p className={styles.sub}>
        Per month, across {calculation.comps.length} comps averaged
      </p>

      <CeilingChart calculation={calculation} />

      <dl className={styles.breakdown}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
