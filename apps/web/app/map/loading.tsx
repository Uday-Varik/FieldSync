// Map loading state (docs/17 §3.3): skeleton in the map
// page's own layout while the server auth check runs. The
// client-side jobs/geocoding load has its own skeleton in
// MapView; no fetch behaviour changes.
import Skeleton from '../../components/ui/Skeleton';
import styles from './page.module.css';

export default function MapLoading() {
  return (
    <div className={styles.page}>
      <h1>Map</h1>
      <Skeleton label="Loading today's jobs…" count={3} variant="card" />
    </div>
  );
}
