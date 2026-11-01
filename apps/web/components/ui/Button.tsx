// Button (docs/17 §§2, 3.2): the one button system for the
// redesign. Variants carry meaning — primary for the main
// action, secondary for ordinary actions, destructive for
// cancel/delete/reopen, ghost for dismiss/back-style actions.
// Colour is never the only signal: destructive buttons keep
// their action text. Busy disables the button (double-submit
// is impossible by disabling, docs/17 §3.3) and appends the
// "…" suffix pattern already used in status messages.
// No data fetching; no API calls.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'default' | 'large';

const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    busy?: boolean;
    children: ReactNode;
  }
>(function Button(
  { variant = 'secondary', size = 'default', busy = false, children, ...props },
  ref,
) {
  const className = [
    styles.button,
    styles[variant],
    size === 'large' ? styles.large : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      disabled={busy || props.disabled}
      className={className}
      ref={ref}
      {...props}
    >
      {children}
      {busy ? (
        <span aria-hidden="true">
          {' '}
          …
        </span>
      ) : null}
    </button>
  );
});

export default Button;
