// Job detail loading state (docs/17 §3.3): skeleton in
// the detail page's own layout while the server fetch
// runs. No fetch behaviour changes; no content is implied
// that will not load.
import Skeleton from '../../../components/ui/Skeleton';
import styles from './page.module.css';

export default function JobDetailLoading() {
  return (
    <div className={styles.page}>
      <h1>Loading job…</h1>
      <Skeleton label="Loading job…" count={5} variant="card" />
    </div>
  );
}
