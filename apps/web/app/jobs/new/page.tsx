import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchMe } from '../../../lib/api';
import CreateJobForm from '../../../components/CreateJobForm';

export default async function NewJobPage() {
  const { userId, getToken } = await auth();
  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <p><Link href="/sign-in">Sign in</Link> to create a job.</p>
      </main>
    );
  }
  const me = await fetchMe(await getToken());
  const role = (me.data as any)?.role as string | undefined;
  if (role === 'TECHNICIAN') {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>New job</h1>
        <p>Technicians cannot create jobs in Phase 1. See <Link href="/my-day">My Day</Link>.</p>
      </main>
    );
  }
  return (
    <main style={{ padding: '2rem' }}>
      <h1>New job</h1>
      <CreateJobForm />
    </main>
  );
}
