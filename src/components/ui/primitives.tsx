import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { Tone } from '@/lib/frv';
import styles from './primitives.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string;
  helper?: string;
  error?: string;
  prefix?: string;
  mono?: boolean;
};

/**
 * Labels stay visible. A placeholder acting as a label disappears exactly when
 * the operator needs it, which on a form this consequential is not a trade
 * worth making for tidiness.
 */
export function Field({ label, helper, error, prefix, mono, id, ...rest }: FieldProps) {
  const fieldId = id ?? `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const describedBy = helper || error ? `${fieldId}-msg` : undefined;

  const input = (
    <input
      {...rest}
      id={fieldId}
      className={`${styles.input} ${mono ? 'mono' : ''}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
    />
  );

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <label className={styles.label} htmlFor={fieldId}>{label}</label>
      {prefix ? (
        <div className={styles.group}>
          <span className={styles.prefix} aria-hidden="true">{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {(error || helper) && (
        <p id={describedBy} className={styles.msg} role={error ? 'alert' : undefined}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

/**
 * The validation language. A blocking banner has no dismiss control anywhere in
 * this system — furnished comps and comps past five miles cannot be overridden
 * by anyone, and an X would imply otherwise.
 */
export function RuleBanner({
  tone,
  rule,
  message,
  detail,
  action,
}: {
  tone: Tone;
  rule?: string;
  message: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${styles.banner} ${styles[`tone-${tone}`]}`} role={tone === 'block' ? 'alert' : 'status'}>
      <span className={`${styles.dot} ${styles[`dot-${tone}`]}`} aria-hidden="true" />
      <div className={styles.bannerBody}>
        {rule && <p className={styles.bannerRule}>{rule}</p>}
        <p className={styles.bannerMsg}>{message}</p>
        {detail && <p className={styles.bannerDetail}>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function LockBadge({ label = 'Locked', version }: { label?: string; version?: number }) {
  return (
    <span className={styles.lock}>
      <span className={`${styles.dot} ${styles['dot-lock']}`} aria-hidden="true" />
      {label}
      {version != null && <span className="mono">v{version}</span>}
    </span>
  );
}
