// Loading skeleton (docs/17 §§3.2, 3.3). Static muted blocks
// only — no shimmer animation, so there is nothing for
// prefers-reduced-motion to suppress, and no skeleton implies
// content that will not load. Rendered by loading.tsx while
// the server fetch runs; fetch behaviour is unchanged.
import styles from './Skeleton.module.css';

export default function Skeleton({
  label = 'Loading…',
  count = 4,
  variant = 'row',
}: {
  label?: string;
  count?: number;
  variant?: 'row' | 'card';
}) {
  return (
    <div role="status" aria-label={label}>
      <p className={styles.label}>{label}</p>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={variant === 'card' ? styles.card : styles.row}
        />
      ))}
    </div>
  );
}
