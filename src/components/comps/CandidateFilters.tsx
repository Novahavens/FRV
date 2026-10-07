import type { CandidateFilter } from '@/lib/listings/types';
import { EMPTY_FILTER } from '@/lib/listings/types';
import styles from './CandidateFilters.module.css';

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ');

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function ChipGroup({
  legend, values, selected, onToggle,
}: { legend: string; values: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (values.length === 0) return null;
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.chips}>
        {values.map((v) => {
          const on = selected.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => onToggle(v)}
              className={`${styles.chip} ${on ? styles.chipOn : ''}`}>
              {titleCase(v)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Narrow a shortlist by facts Zillow's search already returned. Instant, no network. */
export function CandidateFilters({
  filter, onChange, options, total, shown,
}: {
  filter: CandidateFilter;
  onChange: (next: CandidateFilter) => void;
  options: { homeTypes: string[]; pets: string[] };
  total: number;
  shown: number;
}) {
  const dirty =
    filter.homeTypes.length > 0 || filter.pets.length > 0 || filter.availableBy !== null ||
    filter.exactBeds || filter.exactBaths;
  const patch = (p: Partial<CandidateFilter>) => onChange({ ...filter, ...p });

  return (
    <section className={styles.filters} aria-labelledby="candidate-filters-title">
      <div className={styles.head}>
        <h3 id="candidate-filters-title" className={styles.title}>Filter results</h3>
        <span className={styles.count} aria-live="polite">Showing {shown} of {total}</span>
      </div>

      <ChipGroup legend="Home type" values={options.homeTypes} selected={filter.homeTypes}
        onToggle={(v) => patch({ homeTypes: toggle(filter.homeTypes, v) })} />
      <ChipGroup legend="Pets allowed" values={options.pets} selected={filter.pets}
        onToggle={(v) => patch({ pets: toggle(filter.pets, v) })} />

      <div className={styles.row}>
        <label className={styles.date}>
          <span className={styles.legend}>Available by</span>
          <input type="date" className={styles.dateInput} value={filter.availableBy ?? ''}
            onChange={(e) => patch({ availableBy: e.target.value || null })} />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={filter.exactBeds} onChange={(e) => patch({ exactBeds: e.target.checked })} />
          <span>Exact bedrooms</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={filter.exactBaths} onChange={(e) => patch({ exactBaths: e.target.checked })} />
          <span>Exact bathrooms</span>
        </label>
        <button type="button" className={styles.clear} disabled={!dirty} onClick={() => onChange(EMPTY_FILTER)}>
          Clear filters
        </button>
      </div>
    </section>
  );
}
