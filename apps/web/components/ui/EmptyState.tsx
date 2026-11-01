// Empty state (docs/17 §§3.2, 3.3): heading + body +
// optional action. Used for no search results and for an
// empty day; the action is supplied by the page (a link or
// button that already exists in the app's behaviour).
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export default function EmptyState({
  heading,
  body,
  children,
}: {
  heading: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.empty} aria-label={heading}>
      <h2 className={styles.heading}>{heading}</h2>
      {body ? <p className={styles.body}>{body}</p> : null}
      {children ? <div className={styles.actions}>{children}</div> : null}
    </section>
  );
}
