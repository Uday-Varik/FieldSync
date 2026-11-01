// Page header (docs/17 §§3.2, 3.3): one h1 per page, an
// optional supporting line, and an optional actions slot.
// Presentation only; no data fetching.
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export default function PageHeader({
  title,
  supporting,
  children,
}: {
  title: string;
  supporting?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {supporting ? <p className={styles.supporting}>{supporting}</p> : null}
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
