// Field (docs/17 §§1.10, 3.2): visible label + control +
// hint + error, with the aria-describedby / aria-invalid
// wiring. Converts every aria-label-only control to this
// pattern; the accessible name stays the same or clearer.
// Wraps a native input/select/textarea only — no custom
// controls. The control child receives its id and the
// describedby/invalid attributes; callers keep full control
// of value, validation attributes, and behaviour.
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import styles from './Field.module.css';

export default function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const baseId = useId();
  const existingId =
    isValidElement(children) && typeof (children as ReactElement<Record<string, unknown>>).props.id === 'string'
      ? ((children as ReactElement<Record<string, unknown>>).props.id as string)
      : undefined;
  const controlId = existingId ?? `field-${baseId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  let control = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(child, {
      id: child.props.id ?? controlId,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
    });
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {required ? (
          <span aria-hidden="true"> *</span>
        ) : null}
        {required ? <span className={styles.requiredNote}> (required)</span> : null}
      </label>
      {control}
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
