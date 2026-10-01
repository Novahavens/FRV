/**
 * PLACEHOLDER MARK — not the Nova Havens logo.
 *
 * A stand-in so the report, the app header and the PDF have something to lay
 * out against. Replace before anything reaches a carrier.
 *
 * It draws the system's own motif: a ceiling rule with three descending bars
 * beneath it, none touching the rule. Strokes inherit currentColor so it works
 * in both themes and on the PDF's white sheet without a second asset.
 *
 * When the real artwork lands, keep this component's props and swap the
 * internals — every call site already sizes it through `size`.
 */
export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        role="img"
        aria-label="Nova Havens placeholder mark"
      >
        <rect
          x="0.5" y="0.5" width="95" height="95" rx="10"
          fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.35"
        />
        <line x1="20" y1="28.5" x2="76" y2="28.5" stroke="currentColor" strokeWidth="4" />
        <rect x="20" y="40" width="14" height="32" rx="4" fill="currentColor" />
        <rect x="41" y="48" width="14" height="24" rx="4" fill="currentColor" opacity="0.7" />
        <rect x="62" y="56" width="14" height="16" rx="4" fill="currentColor" opacity="0.45" />
      </svg>
      {withWordmark && (
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Nova Havens</span>
      )}
    </span>
  );
}
