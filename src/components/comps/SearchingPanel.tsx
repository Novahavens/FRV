'use client';

import { useEffect, useState } from 'react';
import styles from './SearchingPanel.module.css';

/** Shown while a comp search is running. Wider radii take longer, so say so. */
export function SearchingPanel({ radiusMiles }: { radiusMiles: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.title}>Finding comparables within {radiusMiles} miles.</p>
        <p className={styles.copy}>
          {radiusMiles <= 5
            ? 'This usually takes 10–20 seconds — please be patient.'
            : 'This usually takes 20–60 seconds — wider searches pull more pages.'}
        </p>
      </div>
      <span className={styles.elapsed}>{elapsed}s</span>
    </div>
  );
}
