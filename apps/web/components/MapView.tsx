'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiCall } from '../lib/api-client';

// Phase 3 map view: today's jobs on a Mapbox map.
// Jobs with stored lat/lng (server-geocoded on create,
// Phase 3) plot directly. Jobs without coordinates are
// geocoded client-side via the Mapbox geocoding API so
// older jobs still appear; jobs that cannot be geocoded
// are listed below the map instead of silently dropped.
// Without a Mapbox token the page shows the list only —
// it never renders a broken map.
type PlottedJob = any & { lat: number; lng: number };

export default function MapView() {
  const { getToken } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [plotted, setPlotted] = useState<PlottedJob[]>([]);
  const [unplotted, setUnplotted] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [message, setMessage] = useState('');

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
        setMessage(e instanceof Error ? e.message : 'Failed to load jobs.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, token]);

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
    for (const job of plotted) {
      bounds.extend([job.lng, job.lat]);
      const marker = new mapboxgl.Marker({ color: job.status === 'COMPLETED' ? '#0f5132' : '#b45309' })
        .setLngLat([job.lng, job.lat])
        .addTo(map);
      marker.getElement().addEventListener('click', () => setSelected(job));
      markers.push(marker);
    }
    if (plotted.length > 1) map.fitBounds(bounds, { padding: 40 });
    else map.setCenter([plotted[0].lng, plotted[0].lat]);
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [plotted]);

  if (!token) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Map</h1>
        <p>Mapbox is not configured (NEXT_PUBLIC_MAPBOX_TOKEN is missing), so here are today&apos;s jobs as a list instead of a map.</p>
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`}>{job.title}</Link> — {job.customerName} · {job.status}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Map — today&apos;s jobs</h1>
      {message && <p>{message}</p>}
      <div ref={mapRef} style={{ width: '100%', height: '500px', border: '1px solid #ccc' }} />
      {selected && (
        <section style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
          <h2>{selected.title}</h2>
          <p>
            {selected.customerName} · {selected.status} · {selected.priority}
          </p>
          <p>
            {selected.addressLine1}, {selected.city}, {selected.state} {selected.postalCode}
          </p>
          <p>
            <Link href={`/jobs/${selected.id}`}>Open job detail →</Link>
          </p>
        </section>
      )}
      {unplotted.length > 0 && (
        <section style={{ marginTop: '1rem' }}>
          <h2>Jobs without a map location</h2>
          <ul>
            {unplotted.map((job) => (
              <li key={job.id}>
                <Link href={`/jobs/${job.id}`}>{job.title}</Link> — {job.customerName} · {job.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
