import { formatCents } from '@/lib/frv';
import type { Calculation } from '@/lib/frv';
import styles from './CeilingChart.module.css';

/**
 * The three comps standing under the averaged FRV.
 *
 * The FRV is a ceiling — "the maximum monthly amount the insurance company will
 * approve" — so the chart draws it as one. The rule sits at the averaged figure
 * and the bars are the per-comp FRVs beneath it. An operator sees the shape of
 * their evidence before they read a single number: three bars of similar height
 * is a defensible average, one tall bar and two short ones is a revision fight
 * waiting to happen.
 *
 * Pure SVG, no library, no animation on load. It redraws when the numbers
 * change, which is the only moment movement means anything here.
 */
export function CeilingChart({ calculation }: { calculation: Calculation }) {
  const { comps, averagedFrvCents } = calculation;

  const peak = Math.max(...comps.map((c) => c.frvCents), averagedFrvCents);
  // Headroom above the tallest bar so the ceiling rule never sits on top of one.
  const scaleMax = peak * 1.12;

  const width = 360;
  const height = 168;
  const floor = height - 28;
  const barWidth = 64;
  const gap = 24;
  const startX = (width - (comps.length * barWidth + (comps.length - 1) * gap)) / 2;
  const ceilingY = floor - (averagedFrvCents / scaleMax) * (floor - 12);

  return (
    <figure className={styles.wrap}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.svg}
        role="img"
        aria-label={`Three comparable FRVs beneath an averaged ceiling of ${formatCents(averagedFrvCents)}`}
      >
        {comps.map((comp, i) => {
          const barHeight = (comp.frvCents / scaleMax) * (floor - 12);
          const x = startX + i * (barWidth + gap);
          return (
            <g key={comp.id}>
              <rect
                x={x}
                y={floor - barHeight}
                width={barWidth}
                height={barHeight}
                rx={6}
                className={styles.bar}
              />
              <text x={x + barWidth / 2} y={height - 8} className={styles.tick}>
                {formatCents(comp.frvCents)}
              </text>
            </g>
          );
        })}

        <line x1={12} y1={floor + 0.5} x2={width - 12} y2={floor + 0.5} className={styles.floor} />
        <line x1={12} y1={ceilingY} x2={width - 12} y2={ceilingY} className={styles.ceiling} />
      </svg>
      <figcaption className={styles.caption}>
        Each bar is one comp&rsquo;s FRV. The rule is the average — the ceiling the claim is held to.
      </figcaption>
    </figure>
  );
}
