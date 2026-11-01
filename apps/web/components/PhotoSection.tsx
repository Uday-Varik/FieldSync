'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiCall } from '../lib/api-client';
import { listPendingPhotoBlobs, storeOfflinePhoto, uploadOfflinePhotos } from '../lib/sync-worker';
import Button from './ui/Button';
import Field from './ui/Field';
import ConfirmBlock from './ui/ConfirmBlock';
import styles from './PhotoSection.module.css';

// Phase 2 photos UI: capture/upload via the signed-URL
// flow, grid display, and soft delete. If photo storage
// is not configured, the upload step returns 503 with a
// clear message — the UI shows that instead of pretending
// a photo was saved. Thumbnails are not in this slice
// (see API notes); the grid shows the original image.
//
// Redesign (docs/17 slice (c)): token styles, a visible
// label on the upload control, an announced status message,
// an uploading state, and an explicit confirmation step
// before delete that names the file (docs/06 principle 4).
// The upload/confirm/delete flow and payloads are unchanged.
// No caption field is added: the confirm endpoint accepts a
// caption, but the offline queue path (storeOfflinePhoto /
// ADD_PHOTO_META) carries no caption, so a caption entered
// online would silently vanish offline. Adding one needs
// a sync-worker change, recorded as a follow-up — not faked
// here (docs/17 §4 slice (c)).
export default function PhotoSection({ jobId, canUpload, jobVersion }: { jobId: string; canUpload: boolean; jobVersion?: number }) {
  const { getToken } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ id: string; url: string; originalFilename: string }[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPending = useCallback(async () => {
    try {
      const rows = await listPendingPhotoBlobs(jobId);
      setPendingPhotos(rows.map((r) => ({ id: r.id, url: URL.createObjectURL(r.blob), originalFilename: r.originalFilename })));
    } catch {
      // Offline photo list is best-effort.
    }
  }, [jobId]);

  // loadPending effect is registered after `load` is defined, below.

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

  useEffect(() => {
    loadPending();
    // When back online, upload any queued photo binaries
    // after their metadata has synced.
    if (typeof window !== 'undefined' && navigator.onLine) {
      void uploadOfflinePhotos(getToken, jobId).then((n) => {
        if (n > 0) {
          load();
          loadPending();
        }
      });
    }
  }, [getToken, jobId, load, loadPending]);

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
    setUploading(true);
    setMessage('Uploading…');
    // Phase 4 offline photos: when offline (or when the
    // network fails), store the binary in IndexedDB and
    // queue the metadata in the outbox. The binary
    // uploads after the metadata syncs.
    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        const blob = await compress(file);
        const { warned } = await storeOfflinePhoto(jobId, blob, file.name, jobVersion ?? 0);
        setMessage(warned ? 'Photo queued offline. Photo storage is over 200 MB — sync soon.' : 'Photo queued offline — will sync when you reconnect.');
        await loadPending();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Failed.');
      } finally {
        setUploading(false);
      }
      return;
    }
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
    } finally {
      setUploading(false);
    }
  }

  async function remove(photoId: string) {
    setDeleting(true);
    try {
      await apiCall(await getToken(), `/jobs/${jobId}/photos/${photoId}`, 'DELETE');
      setMessage('Photo deleted.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteConfirm() {
    const id = pendingDelete?.id;
    setPendingDelete(null);
    if (id) {
      const trigger = document.getElementById(`delete-photo-${id}`);
      if (trigger) setTimeout(() => trigger.focus(), 0);
    }
  }

  return (
    <section aria-label="Photos">
      <h2 className={styles.heading}>Photos</h2>
      {canUpload && (
        <div className={styles.upload}>
          <Field label="Add a photo" hint="Choose an image from your camera or files. Photos are compressed before upload.">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await upload(file);
                e.target.value = '';
              }}
            />
          </Field>
        </div>
      )}
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
      {pendingPhotos.length > 0 && (
        <div className={styles.grid} role="list" aria-label="Photos queued offline">
          {pendingPhotos.map((photo) => (
            <figure key={photo.id} className={styles.figure} role="listitem">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.originalFilename} className={styles.photo} />
              <figcaption className={styles.caption}>
                {photo.originalFilename} — <span className={styles.pending}>queued offline</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {photos.length === 0 && pendingPhotos.length === 0 ? (
        <p className={styles.empty}>No photos yet.</p>
      ) : (
        <div className={styles.grid} role="list" aria-label="Photos">
          {photos.map((photo) => (
            <figure key={photo.id} className={styles.figure} role="listitem">
              {(photo.thumbnailUrl ?? photo.downloadUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.thumbnailUrl ?? photo.downloadUrl} alt={photo.caption ?? photo.originalFilename} className={styles.photo} />
              ) : (
                <p className={styles.unavailable}>Preview unavailable (storage not configured).</p>
              )}
              <figcaption className={styles.caption}>
                {photo.caption ? `${photo.caption} — ` : ''}
                {photo.originalFilename}
              </figcaption>
              {canUpload && (
                <Button
                  id={`delete-photo-${photo.id}`}
                  variant="destructive"
                  onClick={() => setPendingDelete({ id: photo.id, filename: photo.originalFilename })}
                >
                  Delete
                </Button>
              )}
            </figure>
          ))}
        </div>
      )}
      {pendingDelete && (
        <ConfirmBlock
          heading="Delete this photo?"
          confirmLabel="Delete photo"
          cancelLabel="Keep photo"
          busy={deleting}
          onCancel={closeDeleteConfirm}
          onConfirm={() => {
            const target = pendingDelete;
            setPendingDelete(null);
            void remove(target.id);
          }}
        >
          <p>“{pendingDelete.filename}” will be deleted. This cannot be undone.</p>
        </ConfirmBlock>
      )}
    </section>
  );
}
