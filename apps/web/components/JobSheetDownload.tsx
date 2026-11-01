'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Button from './ui/Button';
import styles from './JobSheetDownload.module.css';

// Phase 2 job sheet download: fetches the PDF with the
// Clerk Bearer token (a plain <a> link cannot carry it)
// and triggers a browser download. Shown only for
// completed jobs, where the API allows it.
//
// Redesign (docs/17 slice (c)): token styles, a busy state
// while the PDF is fetched, and an announced error message
// (the aria-live gap in docs/17 §1.11). The on-demand
// download behaviour is unchanged.
export default function JobSheetDownload({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setMessage('');
    setBusy(true);
    try {
      const token = await getToken();
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${base}/jobs/${jobId}/job-sheet`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Job sheet unavailable (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-sheet-${jobId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button busy={busy} onClick={download}>
        Download job sheet (PDF)
      </Button>
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
