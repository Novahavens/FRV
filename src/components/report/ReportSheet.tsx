import type { ReportModel, ReportRow } from '@/lib/report/model';
import { Logo } from '@/components/brand/Logo';
import styles from './ReportSheet.module.css';

function Rows({ rows, emphasiseLast = true }: { rows: ReportRow[]; emphasiseLast?: boolean }) {
  const last = rows.length - 1;
  return (
    <dl className={styles.rows}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={emphasiseLast && i === last ? styles.rowTotal : styles.row}
        >
          <dt>{row.label}</dt>
          <dd className="mono">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The report as the adjuster reads it.
 *
 * Sections follow the Alacrity format they already receive — Loss Address
 * Details, FRV Address Details, 12-month FRV Details, guideline tables,
 * declaration — so nobody has to learn where a number lives. The typography,
 * spacing and colour are Nova Havens'.
 */
export function ReportSheet({ model }: { model: ReportModel }) {
  return (
    <article className={styles.sheet} aria-label="Fair Rental Value report">
      <header className={styles.masthead}>
        <div className={styles.brand}>
          <Logo size={26} withWordmark={false} />
        </div>
        <dl className={styles.meta}>
          <div><dt>Claim</dt><dd className="mono">{model.claimIdentifier}</dd></div>
          <div><dt>Date</dt><dd>{model.preparedOn}</dd></div>
          <div><dt>Status</dt><dd>{model.status}{model.version > 1 ? ` · v${model.version}` : ''}</dd></div>
        </dl>
      </header>

      <p className={styles.preamble}>{model.notes.evaluation} {model.notes.availability}</p>

      <section className={model.map ? `${styles.hero} ${styles.heroWithMap}` : styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>Fair Rental Value</h1>
          <p className={styles.figure}>{model.headline.amount}</p>
          <p className={styles.caption}>{model.headline.caption}</p>
        </div>
        {model.map && (
          <figure className={styles.mapCard}>
            <img
              src={model.map.url}
              alt="Aerial map of the loss address and comparables"
              className={styles.map}
            />
            <figcaption className={styles.mapCaption}>{model.map.caption}</figcaption>
          </figure>
        )}
        <div className={styles.lossCard}>
          <h2 className={styles.lossHeading}>Loss Address Details</h2>
          {model.loss.photoUrl ? (
            <img src={model.loss.photoUrl} alt="" className={styles.photo} />
          ) : (
            <img src="/images/generic-house.svg" alt="" className={styles.photo} />
          )}
          <p className={styles.lossAddress}>{model.loss.address}</p>
          <p className={styles.lossMeta}>{model.loss.size}</p>
          <p className={styles.lossMeta}>Square footage: {model.loss.squareFootage}</p>
          <p className={styles.lossMeta}>Minimum lease term: {model.loss.minimumLeaseTerm}</p>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>FRV Address Details — averaged across three comparables</h2>
        <Rows rows={model.averaged} />
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>Comparables used</h2>
        <div className={styles.compGrid}>
          {model.comps.map((comp) => (
            <div key={comp.position} className={styles.compCard}>
              <p className={styles.compIndex}>Comparable {comp.position}</p>
              <a href={comp.url} className={styles.compLink}>{comp.address}</a>
              <p className={styles.compSpec}>{comp.propertyType}</p>
              <p className={styles.compSpec}>{comp.size}</p>
              <p className={styles.compSpec}>Square footage: {comp.squareFootage}</p>
              <p className={styles.compSpec}>Distance from loss address: {comp.distance}</p>
              <Rows rows={comp.rows} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.twoUp}>
        <div className={styles.block}>
          <h2 className={styles.h2}>12-month FRV Details</h2>
          <Rows rows={model.twelveMonth} />
          <p className={styles.footnote}>
            A standard long-term unfurnished placement. No short-term multiplier and no furniture.
          </p>
        </div>
        <div className={styles.block}>
          <h2 className={styles.h2}>Compliance</h2>
          <ul className={styles.compliance}>
            {model.compliance.map((item) => (
              <li key={item.label}>
                <span className={styles.tick} aria-hidden="true" />
                <span><strong>{item.label}.</strong> {item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.twoUp}>
        <div className={styles.block}>
          <h2 className={styles.h2}>Furniture and housewares pricing guideline</h2>
          <Rows rows={model.furnitureTable} emphasiseLast={false} />
          <p className={styles.footnote}>{model.notes.furnitureDisclaimer}</p>
        </div>
        <div className={styles.block}>
          <h2 className={styles.h2}>Short-term rental multipliers applied to base rent</h2>
          <Rows rows={model.multiplierTable} emphasiseLast={false} />
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.neutrality}>{model.notes.neutrality}</p>
        {model.notes.attribution && <p className={styles.attribution}>{model.notes.attribution}</p>}
      </footer>
    </article>
  );
}
