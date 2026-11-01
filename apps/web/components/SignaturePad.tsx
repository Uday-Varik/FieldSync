'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiCall } from '../lib/api-client';
import Button from './ui/Button';
import Field from './ui/Field';
import styles from './SignaturePad.module.css';

// Phase 2 signature capture: a canvas pad (mouse + touch
// via pointer events). The PNG data URL goes to the API's
// POST /jobs/:id/signature endpoint; S3 storage replaces
// the data-URL storage in the photos slice.
//
// Redesign (docs/17 slice (c)): visible label, token
// styles, busy state on save. Canvas size, the honest
// keyboard limitation, and the dispatcher/admin override
// path are preserved exactly.
export default function SignaturePad({ jobId }: { jobId: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signedByName, setSignedByName] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const imageDataUrl = canvasRef.current!.toDataURL('image/png');
      await apiCall(await getToken(), `/jobs/${jobId}/signature`, 'POST', { signedByName, imageDataUrl });
      router.refresh();
      setMessage('Signature saved. You can now complete the job.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.form}>
      <h3 className={styles.heading}>Add a signature</h3>
      <Field label="Signed by (customer name)" hint="The name of the person signing. Keyboard users complete the job through the dispatcher/admin override instead — the drawing area is pointer and touch only.">
        <input type="text" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} autoComplete="off" />
      </Field>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Signature drawing area. Draw with a pointer or touch; keyboard drawing is not supported."
        width={320}
        height={160}
        className={styles.canvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
      <div className={styles.actions}>
        <Button disabled={busy} onClick={clear}>
          Clear
        </Button>
        <Button
          variant="primary"
          busy={busy}
          disabled={!hasDrawing || !signedByName.trim()}
          onClick={save}
        >
          Save signature
        </Button>
      </div>
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
