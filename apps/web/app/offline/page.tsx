import Link from 'next/link';
import PageHeader from '../../components/ui/PageHeader';
import OfflineStatus from './OfflineStatus';
import styles from './page.module.css';

// Static offline fallback page (docs/17 slice (d); docs/06
// F3). The service worker serves this for navigation
// requests when the network is down; the page itself
// contains no user data, so it is safe to cache. The stale
// Phase 2/Phase 4 copy is replaced with the real offline
// position, in the banner's own words: changes queue on
// this device and sync on reconnect, and only jobs opened
// while online are guaranteed offline. The queued-changes
// counts below render client-side only (OfflineStatus), so
// the cached page still carries no user data. PWA behaviour
// — manifest, service worker registration, and this
// fallback — is unchanged.
export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <PageHeader
        title="You are offline"
        supporting="You can keep working on jobs you have already opened. Changes you make will be queued and synced when you reconnect."
      />
      <p>
        Jobs you have opened while online are available offline. Jobs you have not opened while online are not
        guaranteed offline — open My Day and the jobs you need while you are online, so they are saved on this device.
      </p>
      <p className={styles.actions}>
        <Link href="/my-day" className={styles.secondaryLink}>
          Try My Day again
        </Link>
        <Link href="/board" className={styles.secondaryLink}>
          Try the board again
        </Link>
      </p>
      <OfflineStatus />
    </main>
  );
}
