import Link from 'next/link';
import { demoClaim } from '@/lib/report/demo';
import { FrvSummary } from '@/components/frv/FrvSummary';
import { RuleBanner, Button } from '@/components/ui/primitives';
import styles from './page.module.css';

/**
 * The workspace.
 *
 * Renders the shared reference claim so the product is usable before intake
 * exists. Swap `demoClaim()` for a fetch by id once claims are being created.
 */
export default function WorkspacePage() {
  const { loss, calculation } = demoClaim();

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.claimId}>{loss.claimIdentifier}</p>
          <h1 className={styles.address}>{loss.address}</h1>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/report" className={styles.secondaryLink}>View report</Link>
          <Link href="/claims/new"><Button variant="primary">New FRV</Button></Link>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.column}>
          <FrvSummary calculation={calculation} />
        </div>

        <div className={styles.column}>
          <section className={styles.panel} aria-labelledby="rules-heading">
            <h2 id="rules-heading" className={styles.panelHeading}>Rule checks</h2>
            <div className={styles.stack}>
              <RuleBanner
                tone="pass"
                rule="Rule 1 · Unfurnished"
                message="All three comps are unfurnished."
                detail="No furnished flag or short-term keyword found in any listing."
              />
              <RuleBanner
                tone="pass"
                rule="Rule 4 · Geography"
                message="Every comp is within one mile."
                detail="Measured from the coordinates captured at intake."
              />
              <RuleBanner
                tone="info"
                rule="Rule 3 · Sort order"
                message="Comps stored high to low."
                detail="Your entry order is kept in the audit record."
              />
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="comps-heading">
            <h2 id="comps-heading" className={styles.panelHeading}>Comparables</h2>
            <ol className={styles.comps}>
              {calculation.comps.map((comp) => (
                <li key={comp.id} className={styles.comp}>
                  <div className={styles.compMain}>
                    <p className={styles.compAddr}>{comp.address}</p>
                    <p className={styles.compMeta}>
                      {comp.bedrooms} bd · {comp.bathrooms} ba · {comp.sqft.toLocaleString()} sq ft
                    </p>
                  </div>
                  <div className={styles.compRight}>
                    <span className="mono">${(comp.rentCents / 100).toLocaleString()}</span>
                    <span className={styles.compDist}>{comp.distanceMiles.toFixed(1)} miles</span>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/claims/new" className={styles.link}>Start another claim</Link>
          </section>
        </div>
      </div>
    </main>
  );
}
