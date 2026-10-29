import Link from 'next/link';

// Static offline fallback page. The service worker serves
// this for navigation requests when the network is down;
// it contains no user data, so it is safe to cache.
export default function OfflinePage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>You are offline</h1>
      <p>FieldSync needs a connection to load jobs in Phase 2 (offline sync comes in Phase 4).</p>
      <p>
        <Link href="/my-day">Try My Day again</Link>
      </p>
    </main>
  );
}
