// ConfirmBlock (docs/17 §3.3): the inline confirmation
// step for destructive/status-changing actions (cancel and
// reopen a job, delete a photo). An inline confirm block —
// not a modal — so no focus trap is needed; it is
// keyboard-operable (both actions are buttons), cancellable
// with Escape, and focus moves to the safe (cancel) action
// when the block opens. The caller returns focus to the
// action button that opened the block when it closes.
// No endpoint or payload changes: the caller still runs
// exactly the mutation it ran before, only after the user
// confirms.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import Button from './Button';
import styles from './ConfirmBlock.module.css';

export default function ConfirmBlock({
  heading,
  children,
  confirmLabel,
  cancelLabel = 'Go back',
  confirmDisabled = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  heading: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const baseId = useId();
  const headingId = `confirm-${baseId}`;
  const bodyId = `confirm-body-${baseId}`;
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className={styles.confirm}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
    >
      <h3 className={styles.heading} id={headingId}>
        {heading}
      </h3>
      <div className={styles.body} id={bodyId}>
        {children}
      </div>
      <div className={styles.actions}>
        <Button
          ref={cancelRef}
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="destructive"
          busy={busy}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
