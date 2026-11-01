import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchMe } from '../../../lib/api';
import CreateJobForm from '../../../components/CreateJobForm';
import PageHeader from '../../../components/ui/PageHeader';
import EmptyState from '../../../components/ui/EmptyState';
import styles from './page.module.css';

// New job (docs/17 slice (c); docs/06 S14/F1). The form
// itself is CreateJobForm; this page keeps the existing
// guards: signed-out users are pointed at sign-in, and
// technicians are refused with guidance to My Day. No
// guard or data behaviour changes.
export default async function NewJobPage() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader title="New job" />
        <p>
          <Link href="/sign-in" className={styles.textLink}>
            Sign in
          </Link>{' '}
          to create a job.
        </p>
      </main>
    );
  }
  const me = await fetchMe(await getToken());
  const role = (me.data as any)?.role as string | undefined;
  if (role === 'TECHNICIAN') {
    return (
      <main className={styles.page}>
        <PageHeader title="New job" />
        <EmptyState
          heading="Technicians cannot create jobs"
          body="Jobs are created by dispatchers and admins. Your assigned jobs are on My Day."
        >
          <Link href="/my-day" className={styles.secondaryLink}>
            Go to My Day
          </Link>
        </EmptyState>
      </main>
    );
  }
  return (
    <main className={styles.page}>
      <PageHeader
        title="New job"
        supporting="Fill in the job details. The job will be scheduled and, once assigned, appear on the technician's My Day."
      />
      <CreateJobForm />
    </main>
  );
}
