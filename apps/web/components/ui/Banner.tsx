// Banner (docs/17 §§2.1, 3.2): persistent information /
// warning / error panels with an icon + heading + body +
// optional actions. Always persistent, never
// auto-dismissing; sync and error state is always visible,
// never a toast (docs/06 principle 3). Colour is paired
// with an icon and text, never the only signal.
import type { ReactNode } from 'react';
import styles from './Banner.module.css';

export type BannerVariant = 'info' | 'warning' | 'error';

const ICONS: Record<BannerVariant, string> = {
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
};

export default function Banner({
  variant,
  heading,
  children,
  actions,
}: {
  variant: BannerVariant;
  heading?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`${styles.banner} ${styles[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-label={heading}
    >
      <p className={styles.icon} aria-hidden="true">
        {ICONS[variant]}
      </p>
      <div className={styles.body}>
        {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
        <div className={styles.text}>{children}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </section>
  );
}
