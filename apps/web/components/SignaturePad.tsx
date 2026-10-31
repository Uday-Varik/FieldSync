'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';

// Phase 2 signature capture: a canvas pad (mouse + touch
// via pointer events). The PNG data URL goes to the API's
// POST /jobs/:id/signature endpoint; S3 storage replaces
// the data-URL storage in the photos slice.
export default function SignaturePad({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signedByName, setSignedByName] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [message, setMessage] = useState('');

  function point(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = point(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  async function save() {
    setMessage('');
    try {
      const imageDataUrl = canvasRef.current!.toDataURL('image/png');
      await apiCall(await getToken(), `/jobs/${jobId}/signature`, 'POST', { signedByName, imageDataUrl });
      router.refresh();
      setMessage('Signature saved. You can now complete the job.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.');
    }
  }

  return (
    <section style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Customer signature</h2>
      <input
        aria-label="Signed by (customer name)"
        placeholder="Signed by (customer name)"
        value={signedByName}
        onChange={(e) => setSignedByName(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', fontSize: '1rem' }}
      />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Signature drawing area. Draw with a pointer or touch; keyboard drawing is not supported."
        width={320}
        height={160}
        style={{ border: '1px solid #999', touchAction: 'none', width: '100%', maxWidth: '320px', background: '#fff' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="button" style={{ minHeight: '44px', padding: '0.75rem 1rem' }} onClick={clear}>Clear</button>
        <button
          type="button"
          style={{ minHeight: '44px', padding: '0.75rem 1rem' }}
          disabled={!hasDrawing || !signedByName.trim()}
          onClick={save}
        >
          Save signature
        </button>
      </div>
      {message && <p aria-live="polite">{message}</p>}
    </section>
  );
}
