// Status pill / priority badge (docs/17 §§2.3, 3.2).
//
// Props take status/priority keys, never colours. The visual
// pairs live in apps/web/app/globals.css, selected by the
// data-status / data-priority attribute. Labels and glyphs
// below mirror packages/shared STATUS_STYLES / PRIORITY_STYLES
// (the single source of truth for keys, labels, and glyphs);
// the web app does not yet depend on @fieldsync/shared, so
// this table is a local copy — keep the two in sync until a
// wiring slice adds the workspace dependency. No page adopts
// these components in slice (a); slices (b)–(d) adopt them
// when each page is restyled.

export const STATUS_DISPLAY = {
  SCHEDULED: { label: 'Scheduled', glyph: '○' },
  EN_ROUTE: { label: 'En route', glyph: '→' },
  ON_SITE: { label: 'On site', glyph: '◎' },
  IN_PROGRESS: { label: 'In progress', glyph: '◐' },
  ON_HOLD: { label: 'On hold', glyph: '❚❚' },
  COMPLETED: { label: 'Completed', glyph: '✓' },
  CANCELLED: { label: 'Cancelled', glyph: '✕' },
} as const;

export type JobStatusKey = keyof typeof STATUS_DISPLAY;

export const PRIORITY_DISPLAY = {
  LOW: { label: 'Low', glyph: '' },
  NORMAL: { label: 'Normal', glyph: '' },
  HIGH: { label: 'HIGH', glyph: '' },
  URGENT: { label: 'URGENT', glyph: '▲' },
} as const;

export type PriorityKey = keyof typeof PRIORITY_DISPLAY;

export function StatusPill({ status }: { status: JobStatusKey }) {
  const display = STATUS_DISPLAY[status];
  return (
    <span className="status-pill" data-status={status}>
      <span aria-hidden="true">{display.glyph}</span>
      {display.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityKey }) {
  const display = PRIORITY_DISPLAY[priority];
  return (
    <span className="priority-badge" data-priority={priority}>
      {display.glyph ? (
        <span aria-hidden="true">{display.glyph}</span>
      ) : null}
      {display.label}
    </span>
  );
}
