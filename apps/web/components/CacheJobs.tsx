'use client';

import { useEffect } from 'react';
import { cacheJobs } from '../lib/sync-worker';

// Phase 4 auto-cache: while online, cache the jobs shown
// on this page into IndexedDB so a technician can open
// them offline. Only jobs opened while online are
// guaranteed offline (docs/07 §2).
export default function CacheJobs({ jobs }: { jobs: any[] }) {
  useEffect(() => {
    if (jobs.length === 0) return;
    if (typeof window === 'undefined' || !navigator.onLine) return;
    void cacheJobs(jobs).catch(() => {});
  }, [jobs]);
  return null;
}
