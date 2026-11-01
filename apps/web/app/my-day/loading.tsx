// My Day loading state (docs/17 §3.3): skeleton rows while
// the server fetch runs. No fetch behaviour changes; no
// content is implied that will not load.
import Skeleton from '../../components/ui/Skeleton';
import styles from './page.module.css';

export default function MyDayLoading() {
  return (
    <div className={styles.page}>
      <h1>My Day</h1>
      <Skeleton label="Loading jobs…" count={5} variant="row" />
    </div>
  );
}
