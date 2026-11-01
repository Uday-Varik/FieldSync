import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import MapView from '../../components/MapView';
import PageHeader from '../../components/ui/PageHeader';
import styles from './page.module.css';

// Map page (docs/17 slice (d); docs/06 S12). The signed-in
// map, legend, list/map interplay, and fallback list live in
// MapView; this page only guards the signed-out state, as
// before — no data fetching or auth behaviour changed.
export default async function MapPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader title="Map" />
        <p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>{' '}
          to view the map.
        </p>
      </main>
    );
  }
  return <MapView />;
}
