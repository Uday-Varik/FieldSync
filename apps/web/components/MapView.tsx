'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiCall } from '../lib/api-client';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import Skeleton from './ui/Skeleton';
import Banner from './ui/Banner';
import Button from './ui/Button';
import JobCard from './ui/JobCard';
import {
  PRIORITY_DISPLAY,
  STATUS_DISPLAY,
  StatusPill,
  PriorityBadge,
  type JobStatusKey,
  type PriorityKey,
} from './ui/StatusPill';
import {
  isOverdue,
  windowLabel,
  type BoardJob,
} from '../lib/job-presentation';
import styles from './MapView.module.css';

// Phase 3 map view, restyled in docs/17 slice (d). Jobs with
// stored lat/lng (server-geocoded on create, Phase 3) plot
// directly. Jobs without coordinates are geocoded client-side
// via the Mapbox geocoding API so older jobs still appear;
// jobs that cannot be geocoded are listed below the map
// instead of silently dropped. Without a Mapbox token the
// page shows the list only — it never renders a broken map.
// Mapbox configuration, the geocoding calls, and the
// sequential per-job geocoding order are unchanged; only
// presentation changed: pins use the §2.3 status pairs
// (colour + glyph + legend label, never colour alone), pins
// are real buttons (keyboard-reachable), selecting a list
// job highlights its pin and selecting a pin highlights its
// list entry, and the selected-job panel shows the same
// facts as the job cards. Data fetching and the list/map
// fallback behaviour are unchanged.
type PlottedJob = any & { lat: number; lng: number };

const STATUSES = [
  'SCHEDULED',
  'EN_ROUTE',
  'ON_SITE',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const satisfies readonly JobStatusKey[];

function isStatusKey(status: string): status is JobStatusKey {
  return status in STATUS_DISPLAY;
}

function isPriorityKey(priority: string): priority is PriorityKey {
  return priority in PRIORITY_DISPLAY;
}

function fullAddress(job: any): string {
  return [job.addressLine1, job.addressLine2, job.city, job.state, job.postalCode]
    .filter(Boolean)
    .join(', ');
}

function scheduledLabel(job: any): string {
  const window = windowLabel(job as BoardJob);
  const date = typeof job.scheduledDate === 'string' ? job.scheduledDate.slice(0, 10) : null;
  if (date && window) return `${date} · ${window}`;
  if (date) return date;
  return window ?? 'No time window';
}

export default function MapView() {
  const { getToken } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const pinElements = useRef(new Map<string, HTMLElement>());
  const [jobs, setJobs] = useState<any[]>([]);
  const [plotted, setPlotted] = useState<PlottedJob[]>([]);
  const [unplotted, setUnplotted] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
        const res = await apiCall(await getToken(), `/jobs?date=${today}&limit=100`, 'GET');
        if (cancelled) return;
        const list = res.data ?? [];
        setJobs(list);
        if (!token) {
          setUnplotted(list);
          return;
        }
        const withCoords: PlottedJob[] = [];
        const without: any[] = [];
        for (const job of list) {
          if (typeof job.lat === 'number' && typeof job.lng === 'number') {
            withCoords.push(job);
          } else {
            const address = [job.addressLine1, job.addressLine2, job.city, job.state, job.postalCode].filter(Boolean).join(', ');
            try {
              const geo = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`,
              );
              const data = await geo.json();
              const center = data?.features?.[0]?.center;
              if (center) withCoords.push({ ...job, lng: center[0], lat: center[1] });
              else without.push(job);
            } catch {
              without.push(job);
            }
            if (cancelled) return;
          }
        }
        setPlotted(withCoords);
        setUnplotted(without);
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : 'Failed to load jobs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, token, reloadKey]);

  useEffect(() => {
    if (!token || !mapRef.current || mapInstance.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-90.05, 35.15],
      zoom: 10,
    });
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || plotted.length === 0) return;
    const markers: mapboxgl.Marker[] = [];
    const bounds = new mapboxgl.LngLatBounds();
    pinElements.current.clear();
    for (const job of plotted) {
      bounds.extend([job.lng, job.lat]);
      const statusKey: JobStatusKey | null = isStatusKey(job.status) ? job.status : null;
      const display = statusKey
        ? STATUS_DISPLAY[statusKey]
        : { label: String(job.status).replaceAll('_', ' '), glyph: '•' };
      const element = document.createElement('button');
      element.type = 'button';
      element.className = styles.pin;
      if (statusKey) element.dataset.status = statusKey;
      element.setAttribute('aria-label', `${job.title}, ${display.label}. Show this job.`);
      const glyph = document.createElement('span');
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = display.glyph;
      element.appendChild(glyph);
      element.addEventListener('click', () => {
        setSelected(job);
        // Bring the matching list entry into view once the
        // selection has rendered; the list is the non-map
        // path to the same job, so the two stay in sync.
        window.setTimeout(() => {
          document
            .querySelector(`[data-map-job-id="${job.id}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }, 0);
      });
      const marker = new mapboxgl.Marker({ element }).setLngLat([job.lng, job.lat]).addTo(map);
      pinElements.current.set(job.id, element);
      markers.push(marker);
    }
    if (plotted.length > 1) map.fitBounds(bounds, { padding: 40 });
    else map.setCenter([plotted[0].lng, plotted[0].lat]);
    return () => {
      markers.forEach((m) => m.remove());
      pinElements.current.clear();
    };
  }, [plotted]);

  // Highlight the selected pin, and centre the map on it, when
  // the selection changes from either the list or a pin.
  useEffect(() => {
    for (const [id, element] of pinElements.current) {
      const isSelected = selected?.id === id;
      element.classList.toggle(styles.pinSelected, isSelected);
      element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
    if (selected && mapInstance.current) {
      mapInstance.current.setCenter([selected.lng, selected.lat]);
    }
  }, [selected]);

  function retry() {
    setMessage('');
    setLoading(true);
    setJobs([]);
    setPlotted([]);
    setUnplotted([]);
    setSelected(null);
    setReloadKey((key) => key + 1);
  }

  function selectFromList(job: any) {
    setSelected(job);
  }

  const selectedOverdue = selected ? isOverdue(selected as BoardJob) : false;
  const selectedAddress = selected ? fullAddress(selected) : '';
  const selectedIsPriorityKey = selected ? isPriorityKey(selected.priority) : false;

  if (!token) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Map"
          supporting="Today's jobs, shown as a list because the map is not available right now."
        />
        {loading ? (
          <Skeleton label="Loading today's jobs…" count={4} variant="card" />
        ) : message ? (
          <Banner
            variant="error"
            heading="Jobs could not be loaded"
            actions={<Button onClick={retry}>Retry</Button>}
          >
            <p>Jobs couldn&apos;t be loaded right now. The service isn&apos;t responding — try again.</p>
            <p>{message}</p>
          </Banner>
        ) : jobs.length === 0 ? (
          <EmptyState heading="No jobs for today" body="There are no jobs scheduled for today.">
            <Link href="/board">View the board</Link>
          </EmptyState>
        ) : (
          <section aria-label="Today's jobs">
            <ul className={styles.cards}>
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job as BoardJob} overdue={isOverdue(job as BoardJob)} showDate />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Map — today's jobs"
        supporting="Jobs scheduled for today (America/Chicago). Select a pin or a job in the list to see its details."
      />
      <section className={styles.legend} aria-label="Map legend">
        <h2 className={styles.legendTitle}>Legend</h2>
        <ul className={styles.legendList}>
          {STATUSES.map((status) => (
            <li key={status}>
              <StatusPill status={status} />
            </li>
          ))}
        </ul>
        <p className={styles.legendNote}>
          Each pin&apos;s colour and symbol match the job&apos;s status. The list below the map shows the same jobs.
        </p>
      </section>
      {loading ? (
        <Skeleton label="Loading today's jobs…" count={3} variant="card" />
      ) : null}
      {message ? (
        <Banner
          variant="error"
          heading="Jobs could not be loaded"
          actions={<Button onClick={retry}>Retry</Button>}
        >
          <p>Jobs couldn&apos;t be loaded right now. The service isn&apos;t responding — try again.</p>
          <p>{message}</p>
        </Banner>
      ) : null}
      <div className={`${styles.layout} ${selected ? styles.layoutWithPanel : ''}`}>
        <div ref={mapRef} className={styles.map} role="region" aria-label="Map of today's jobs" />
        {selected && (
          <section className={styles.panel} aria-label={`Selected job: ${selected.title}`} aria-live="polite">
            <h2 className={styles.panelTitle}>{selected.title}</h2>
            <p className={styles.panelMeta}>{selected.customerName}</p>
            {selectedAddress ? <p className={styles.panelMeta}>{selectedAddress}</p> : null}
            <p className={styles.panelMeta}>{scheduledLabel(selected)}</p>
            <div className={styles.panelBadges}>
              {isStatusKey(selected.status) ? (
                <StatusPill status={selected.status} />
              ) : (
                <span className="status-pill">{String(selected.status).replaceAll('_', ' ')}</span>
              )}
              {selectedIsPriorityKey ? (
                <PriorityBadge priority={selected.priority} />
              ) : (
                <span className="priority-badge">{selected.priority}</span>
              )}
              {selectedOverdue ? (
                <span className={styles.overdueFlag}>
                  <span aria-hidden="true">◷</span> Overdue
                </span>
              ) : null}
            </div>
            <div className={styles.panelActions}>
              <Link href={`/jobs/${selected.id}`} className={styles.secondaryLink}>
                Open job detail
              </Link>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close panel
              </Button>
            </div>
          </section>
        )}
      </div>
      {!loading && !message && jobs.length === 0 ? (
        <EmptyState heading="No jobs for today" body="There are no jobs scheduled for today.">
          <Link href="/board">View the board</Link>
        </EmptyState>
      ) : null}
      {!loading && plotted.length > 0 ? (
        <section className={styles.listSection} aria-label="Today's jobs on the map">
          <h2 className={styles.listTitle}>Today&apos;s jobs on the map ({plotted.length})</h2>
          <ul className={styles.cards}>
            {plotted.map((job) => (
              <li
                key={job.id}
                data-map-job-id={job.id}
                className={`${styles.cardItem} ${selected?.id === job.id ? styles.cardItemSelected : ''}`}
                aria-current={selected?.id === job.id ? 'true' : undefined}
              >
                <JobCard job={job as BoardJob} overdue={isOverdue(job as BoardJob)} showDate />
                <div className={styles.showButton}>
                  <Button onClick={() => selectFromList(job)} aria-pressed={selected?.id === job.id}>
                    {selected?.id === job.id ? 'Selected on map' : 'Show on map'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!loading && unplotted.length > 0 ? (
        <section className={styles.listSection} aria-label="Jobs without a map location">
          <h2 className={styles.listTitle}>Jobs without a map location ({unplotted.length})</h2>
          <p className={styles.sectionNote}>
            These jobs have no map location, so they are listed here instead of on the map. Open a job to see its
            details.
          </p>
          <ul className={styles.cards}>
            {unplotted.map((job) => (
              <li key={job.id}>
                <JobCard job={job as BoardJob} overdue={isOverdue(job as BoardJob)} showDate />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
