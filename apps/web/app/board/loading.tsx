// Board loading state (docs/17 §3.3): skeleton in the
// board's own layout while the server fetch runs. No fetch
// behaviour changes; no content is implied that will not load.
import Skeleton from '../../components/ui/Skeleton';
import styles from './page.module.css';

export default function BoardLoading() {
  return (
    <div className={styles.page}>
      <h1>Board</h1>
      <Skeleton label="Loading jobs…" count={6} variant="card" />
    </div>
  );
}
