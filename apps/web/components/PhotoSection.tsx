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

  async function upload(file: File) {
    setMessage('Uploading…');
    try {
      const token = await getToken();
      const { uploadUrl, storageKey } = await apiCall(token, `/jobs/${jobId}/photos/upload-url`, 'POST', {
        filename: file.name,
        contentType: file.type || 'image/jpeg',
      });
      const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } });
      if (!put.ok) throw new Error(`Upload to storage failed (${put.status})`);
      await apiCall(token, `/jobs/${jobId}/photos/confirm`, 'POST', {
        storageKey,
        originalFilename: file.name,
        fileSizeBytes: file.size,
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
              {photo.downloadUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.downloadUrl} alt={photo.caption ?? photo.originalFilename} style={{ width: '100%' }} />
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
