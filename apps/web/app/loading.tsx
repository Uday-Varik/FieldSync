// Homepage loading state (docs/17 §3.3): skeleton while
// the server auth / /me fetch runs. No fetch behaviour
// changes; no content is implied that will not load.
import Skeleton from '../components/ui/Skeleton';
import styles from './page.module.css';

export default function HomeLoading() {
  return (
    <div className={styles.page}>
      <h1>FieldSync</h1>
      <Skeleton label="Loading…" count={3} variant="card" />
    </div>
  );
}
