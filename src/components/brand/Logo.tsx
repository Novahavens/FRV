export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'inherit' }}>
      <img
        src="/brand/nova-havens-logo.png"
        alt="Nova Havens"
        style={{ width: size, height: size, display: 'block' }}
      />
      {withWordmark && (
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Nova Havens Fair Rental Value
        </span>
      )}
    </span>
  );
}
