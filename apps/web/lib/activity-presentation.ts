// Human-readable audit entries (docs/17 §§1.5, 2.3; US-X1).
// Presentation only: the activity rows the API already
// returns are rendered without raw JSON payloads and without
// raw rule/status codes. Status codes use the shared human
// labels (STATUS_DISPLAY, the same labels StatusPill shows).
// Every entry is kept, in the order the API returns it.
// Two honest limits, from the data the API returns:
// - A row carries actorId only — no actor name is returned,
//   so no name is shown and none is invented.
// - Note text is never rendered: NOTE_UPDATED rows keep the
//   previous text in fromValue for the record, but the
//   timeline says the notes changed, it does not quote them.
// Unknown actions fall back to the code with underscores
// turned into spaces, so a future action still reads as
// words instead of a code — no entry is dropped.
import { STATUS_DISPLAY, type JobStatusKey } from '../components/ui/StatusPill';

export type ActivityEntry = {
  id: string;
  action: string;
  fromValue?: unknown;
  toValue?: unknown;
  metadata?: {
    offline?: boolean;
    reason?: string;
    conflictDetails?: {
      rule?: string;
      serverStatus?: string;
      fieldsApplied?: string[];
      field?: string;
    };
  } | null;
  createdAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function statusLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value in STATUS_DISPLAY) return STATUS_DISPLAY[value as JobStatusKey].label;
  return null;
}

function words(code: string): string {
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

const FIELD_LABELS: Record<string, string> = {
  scheduledDate: 'scheduled date',
  scheduledWindowStart: 'window start',
  scheduledWindowEnd: 'window end',
  internalNotes: 'notes',
  customerNotes: 'customer notes',
  description: 'description',
  title: 'title',
  customerName: 'customer name',
  addressLine1: 'address',
  city: 'city',
  state: 'state',
  postalCode: 'postal code',
  priority: 'priority',
  assignedTechnicianId: 'assigned technician',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function statusChange(fromValue: unknown, toValue: unknown): string | null {
  const from = isRecord(fromValue) ? statusLabel(fromValue.status) : statusLabel(fromValue);
  const to = isRecord(toValue) ? statusLabel(toValue.status) : statusLabel(toValue);
  if (!from && !to) return null;
  if (from && to) return `${from} → ${to}`;
  if (to) return `→ ${to}`;
  return `was ${from}`;
}

export function describeActivity(
  entry: ActivityEntry,
  checklistLabels: Record<string, string> = {},
): string {
  const { action, fromValue, toValue, metadata } = entry;
  const reason = isRecord(metadata) && typeof metadata.reason === 'string' ? metadata.reason : null;

  switch (action) {
    case 'CREATED':
      return 'Job created';
    case 'STATUS_CHANGED': {
      const change = statusChange(fromValue, toValue);
      return change ? `Status changed: ${change}` : 'Status changed';
    }
    case 'ASSIGNED':
      return 'Technician assigned';
    case 'UNASSIGNED':
      return 'Technician unassigned';
    case 'CANCELLED': {
      const change = statusChange(fromValue, toValue);
      const base = change ? `Job cancelled (${change})` : 'Job cancelled';
      return reason ? `${base}. Reason: ${reason}` : base;
    }
    case 'REOPENED': {
      const change = statusChange(fromValue, toValue);
      const base = change ? `Job reopened (${change})` : 'Job reopened';
      return reason ? `${base}. Reason: ${reason}` : base;
    }
    case 'CHECKLIST_CHECKED':
    case 'CHECKLIST_UNCHECKED': {
      const checked = action === 'CHECKLIST_CHECKED';
      const itemId = isRecord(toValue) && typeof toValue.itemId === 'string' ? toValue.itemId : null;
      const label = itemId ? checklistLabels[itemId] : undefined;
      const item = label ? `“${label}”` : 'a checklist item';
      return checked ? `Checklist item checked: ${item}` : `Checklist item unchecked: ${item}`;
    }
    case 'CHECKLIST_ITEM_ADDED': {
      const label = isRecord(toValue) && typeof toValue.label === 'string' ? toValue.label : null;
      return label ? `Checklist item added: “${label}”` : 'Checklist item added';
    }
    case 'UPDATED': {
      if (isRecord(toValue)) {
        const fields = Object.keys(toValue).map(fieldLabel);
        if (fields.length > 0) return `Job updated: ${fields.join(', ')}`;
      }
      return 'Job updated';
    }
    case 'NOTE_UPDATED':
      return 'Job notes updated (previous text kept in the record)';
    case 'SIGNATURE_CAPTURED': {
      const name = isRecord(toValue) && typeof toValue.signedByName === 'string' ? toValue.signedByName : null;
      return name ? `Signature captured, signed by ${name}` : 'Signature captured';
    }
    case 'PHOTO_ADDED': {
      const filename =
        isRecord(toValue) && typeof toValue.originalFilename === 'string' ? toValue.originalFilename : null;
      return filename ? `Photo added: ${filename}` : 'Photo added';
    }
    case 'PHOTO_DELETED':
      return 'Photo deleted';
    default:
      return words(action);
  }
}

export function describeSyncResolution(entry: ActivityEntry): string | null {
  const details = isRecord(entry.metadata) ? entry.metadata.conflictDetails : undefined;
  if (!details) return null;
  const serverStatus = statusLabel(details.serverStatus);
  if (serverStatus) return `Sync resolved a conflict: the job is now ${serverStatus}. Notes and photos were kept.`;
  if (details.fieldsApplied && details.fieldsApplied.length > 0) {
    return `Sync resolved a conflict: changes to ${details.fieldsApplied.map(fieldLabel).join(', ')} were applied, and other fields were preserved.`;
  }
  if (details.field) {
    return 'Sync resolved a conflict: the note was applied, and the previous text is preserved in the job history.';
  }
  return 'Sync resolved a conflict. Notes and photos were kept.';
}

export function formatActivityTime(createdAt?: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt.slice(0, 19).replace('T', ' ');
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
