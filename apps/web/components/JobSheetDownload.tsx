'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiCall } from '../lib/api-client';

// Phase 2 job sheet download: fetches the PDF with the
// Clerk Bearer token (a plain <a> link cannot carry it)
// and triggers a browser download. Shown only for
// completed jobs, where the API allows it.
export default function JobSheetDownload({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const [message, setMessage] = useState('');

  async function download() {
    setMessage('');
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
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <button type="button" style={{ minHeight: '44px', padding: '0.75rem 1rem' }} onClick={download}>
        Download job sheet (PDF)
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
