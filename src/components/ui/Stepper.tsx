import type { KeyboardEvent } from 'react';
import { formatValue, nextValue, parseValue } from './stepper-math';
import styles from './Stepper.module.css';

export interface StepperProps {
  id: string;
  label: string;
  /** The form's string state, so the stepper drops into existing state unchanged. */
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step: number;
  helper?: string;
}

/**
 * A count with up and down arrows and no text entry. Typing a bedroom count
 * invites typos (a stray 0 or 45) that the form only catches on submit, so the
 * value moves in fixed steps instead. The value is still a plain string in the
 * form's state, and the arrow keys work when the value has focus.
 */
export function Stepper({ id, label, value, onChange, min, max, step, helper }: StepperProps) {
  const current = parseValue(value);
  const display = current === null ? '—' : formatValue(current);
  const bounds = { min, max, step };
  const helperId = helper ? `${id}-msg` : undefined;

  const move = (direction: 1 | -1) => onChange(String(nextValue(current, direction, bounds)));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        onChange(String(min));
        break;
      case 'End':
        e.preventDefault();
        onChange(String(max));
        break;
    }
  };

  return (
    <div className={styles.field}>
      <span id={`${id}-label`} className={styles.label}>{label}</span>
      <div className={styles.box}>
        <div
          id={id}
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-describedby={helperId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current ?? undefined}
          aria-valuetext={current === null ? 'not set' : display}
          onKeyDown={onKeyDown}
          className={styles.value}
        >
          {display}
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label.toLowerCase()}`}
            disabled={current !== null && current >= max}
            onClick={() => move(1)}
            className={styles.arrow}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={current !== null && current <= min}
            onClick={() => move(-1)}
            className={styles.arrow}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {helper && <p id={helperId} className={styles.msg}>{helper}</p>}
    </div>
  );
}
