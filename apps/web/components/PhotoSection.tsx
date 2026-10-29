'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiCall } from '../lib/api-client';

// Phase 2 photos UI: capture/upload via the signed-URL
// flow, grid display, and soft delete. If photo storage
// is not configured, the upload step returns 503 with a
// clear message — the UI shows that instead of pretending
// a photo was saved. Thumbnails are not in this slice
// (see API notes); the grid shows the original image.
export default function PhotoSection({ jobId, canUpload }: { jobId: string; canUpload: boolean }) {
  const { getToken } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiCall(await getToken(), `/jobs/${jobId}/photos`, 'GET');
      setPhotos(res.data ?? []);
    } catch {
      // List failure is shown on upload attempts; a bare
      // grid must not crash the job detail page.
    }
  }, [getToken, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Client compression (Phase 2 fix): shrink photos to at
  // most 1600px on the long edge as JPEG 0.8 before upload,
  // so phone photos do not hit storage at full resolution.
  // Any failure falls back to the original file — a photo
  // must not be lost because compression failed.
  async function compress(file: File): Promise<Blob> {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1) return file;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      return blob ?? file;
    } catch {
      return file;
    }
  }

  async function upload(file: File) {
    setMessage('Uploading…');
    try {
      const token = await getToken();
      const blob = await compress(file);
      const { uploadUrl, storageKey } = await apiCall(token, `/jobs/${jobId}/photos/upload-url`, 'POST', {
        filename: file.name,
        contentType: 'image/jpeg',
      });
      const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      if (!put.ok) throw new Error(`Upload to storage failed (${put.status})`);
      await apiCall(token, `/jobs/${jobId}/photos/confirm`, 'POST', {
        storageKey,
        originalFilename: file.name,
        fileSizeBytes: blob.size,
      });
      setMessage('Photo saved.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    }
  }

  async function remove(photoId: string) {
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/photos/${photoId}`, 'DELETE');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    }
  }

  return (
    <section style={{ marginTop: '1rem' }}>
      <h2>Photos</h2>
      {canUpload && (
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
          style={{ minHeight: '44px' }}
        />
      )}
      {message && <p>{message}</p>}
      {photos.length === 0 ? (
        <p>No photos yet.</p>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {photos.map((photo) => (
            <figure key={photo.id} style={{ margin: 0, maxWidth: '200px' }}>
              {(photo.thumbnailUrl ?? photo.downloadUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt={photo.caption ?? photo.originalFilename} style={{ width: '100%' }} />
              ) : (
                <p>Preview unavailable (storage not configured).</p>
              )}
              <figcaption>{photo.originalFilename}</figcaption>
              {canUpload && (
                <button type="button" onClick={() => remove(photo.id)} style={{ minHeight: '44px', padding: '0.5rem 1rem' }}>
                  Delete
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
