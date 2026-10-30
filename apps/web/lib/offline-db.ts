import Dexie, { type Table } from 'dexie';

/**
 * Phase 4 offline store (docs/07 §2): IndexedDB via Dexie.
 *
 * Tables:
 * - jobs: local copy of assigned jobs (full job + checklist),
 *   cached only after the job has been opened while online.
 *   A job never opened online is NOT guaranteed offline —
 *   the UI must say so, and the offline banner does.
 * - outbox: ordered queue of mutations not yet confirmed
 *   by the server. FIFO per job; jobs are independent, so
 *   a stuck job never blocks other jobs' sync.
 * - photoBlobs: photo binaries captured offline (slice 3).
 * - syncMeta: lastSyncAt, pending counts, stored
 *   conflict details for the banner (slice 3).
 *
 * The DB is created lazily, client-side only: importing
 * this module on the server (Next SSR of a client
 * component) must not touch IndexedDB.
 */
export interface OutboxItem {
  id?: number;
  clientMutationId: string;
  type: 'UPDATE_STATUS' | 'UPDATE_JOB_FIELDS' | 'TOGGLE_CHECKLIST' | 'ADD_CHECKLIST_ITEM' | 'ADD_NOTE' | 'ADD_SIGNATURE' | 'ADD_PHOTO_META';
  jobId: string;
  payload: Record<string, any>;
  clientVersion: number;
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'APPLIED';
  error?: string;
  conflictDetails?: Record<string, any>;
}

export interface CachedJob {
  id: string;
  job: any;
  serverVersion: number;
  cachedAt: string;
}

export interface PhotoBlobRow {
  id: string;
  jobId: string;
  blob: Blob;
  originalFilename: string;
  caption?: string;
  createdAt: string;
  status: 'PENDING' | 'UPLOADING' | 'DONE' | 'FAILED';
}

export interface SyncMetaRow {
  key: string;
  value: any;
}

class OfflineDB extends Dexie {
  jobs!: Table<CachedJob, string>;
  outbox!: Table<OutboxItem, number>;
  photoBlobs!: Table<PhotoBlobRow, string>;
  syncMeta!: Table<SyncMetaRow, string>;

  constructor() {
    super('fieldsync-offline');
    this.version(1).stores({
      jobs: 'id',
      outbox: '++id, jobId, status, createdAt',
      photoBlobs: 'id, jobId, status',
      syncMeta: 'key',
    });
  }
}

let _db: OfflineDB | null = null;

export function getDb(): OfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('Offline DB is client-only');
  }
  if (!_db) _db = new OfflineDB();
  return _db;
}

export async function getPendingCount(): Promise<number> {
  try {
    return await getDb().outbox.where('status').equals('PENDING').count();
  } catch {
    return 0;
  }
}

export async function getConflicts(): Promise<Record<string, any>[]> {
  try {
    const row = await getDb().syncMeta.get('conflicts');
    return row?.value ?? [];
  } catch {
    return [];
  }
}
