'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@clerk/nextjs';
import { apiCall } from '../lib/api-client';

// Phase 3 collaborative notes (Yjs).
//
// A Yjs document per job, with a Y.Text called 'notes'.
// With NEXT_PUBLIC_YJS_WS_URL set, a y-websocket provider
// syncs the document live and Awareness shows who else
// is editing. Without it, the editor is local-only —
// still a real Yjs document, just without live sync.
// Persistence is the API snapshot: Save writes
// Y.encodeStateAsUpdate(doc) to POST /jobs/:id/notes/
// snapshot (JobNoteDocument.yjsSnapshot), and Load
// applies a saved snapshot to a fresh document. That
// snapshot is also the fallback the plan names: if Yjs
// sync ever blocks, plain notes (JobNotesForm) plus
// this snapshot remain, with last-write-wins on save.
export default function YjsNotes({ jobId, userName }: { jobId: string; userName: string }) {
  const { getToken } = useAuth();
  const docRef = useRef<Y.Doc | null>(null);
  const textRef = useRef<Y.Text | null>(null);
  const [value, setValue] = useState('');
  const [online, setOnline] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const doc = new Y.Doc();
    const ytext = doc.getText('notes');
    docRef.current = doc;
    textRef.current = ytext;
    let provider: WebsocketProvider | null = null;
    const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL;
    if (wsUrl) {
      provider = new WebsocketProvider(wsUrl, `job-notes-${jobId}`, doc);
      provider.awareness.setLocalStateField('user', { name: userName });
      const updateOnline = () => {
        const names: string[] = [];
        provider!.awareness.getStates().forEach((state: any) => {
          if (state?.user?.name) names.push(state.user.name);
        });
        setOnline(names);
      };
      provider.awareness.on('change', updateOnline);
      updateOnline();
    }
    const observer = () => setValue(ytext.toString());
    ytext.observe(observer);
    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall(await getToken(), `/jobs/${jobId}/notes/snapshot`, 'GET');
        if (!cancelled && res.snapshotBase64) {
          const bytes = Uint8Array.from(atob(res.snapshotBase64), (c) => c.charCodeAt(0));
          Y.applyUpdate(doc, bytes);
          setValue(ytext.toString());
        }
      } catch {
        // No snapshot yet is normal for a new job's notes.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      ytext.unobserve(observer);
      provider?.destroy();
      doc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  function onChange(next: string) {
    const ytext = textRef.current;
    if (!ytext) return;
    const current = ytext.toString();
    if (next === current) return;
    // Common prefix/suffix diff, so concurrent edits
    // elsewhere in the text are not clobbered.
    let start = 0;
    while (start < current.length && start < next.length && current[start] === next[start]) start++;
    let endCurrent = current.length;
    let endNext = next.length;
    while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
      endCurrent--;
      endNext--;
    }
    const doc = docRef.current!;
    doc.transact(() => {
      if (endCurrent > start) ytext.delete(start, endCurrent - start);
      if (endNext > start) ytext.insert(start, next.slice(start, endNext));
    });
    setValue(next);
  }

  async function save() {
    setMessage('');
    try {
      const doc = docRef.current!;
      const update = Y.encodeStateAsUpdate(doc);
      const base64 = btoa(String.fromCharCode(...update));
      await apiCall(await getToken(), `/jobs/${jobId}/notes/snapshot`, 'POST', { snapshotBase64: base64 });
      setMessage('Notes snapshot saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    }
  }

  return (
    <section style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Collaborative notes (Yjs)</h2>
      <p style={{ fontSize: '0.9rem' }}>
        {process.env.NEXT_PUBLIC_YJS_WS_URL
          ? `Live sync on${online.length > 0 ? ` · Editing now: ${online.join(', ')}` : ''}`
          : 'Local Yjs document — set NEXT_PUBLIC_YJS_WS_URL for live multi-user sync. Save below persists a snapshot to the job.'}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        style={{ width: '100%', fontSize: '1rem', padding: '0.5rem' }}
        placeholder="Shared job notes…"
      />
      <button type="button" onClick={save} disabled={!loaded} style={{ minHeight: '44px', padding: '0.75rem 1rem', marginTop: '0.5rem' }}>
        Save notes snapshot
      </button>
      {message && <p>{message}</p>}
    </section>
  );
}
