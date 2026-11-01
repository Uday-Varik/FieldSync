import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchMe } from '../lib/api';

// Phase 1 dashboard shell, not a board yet. It proves the
// web -> Clerk -> API chain: signed-in users see their
// /me result (or a clear unlinked / API-down state), and
// signed-out users see a landing state, not a crash.
export default async function Home() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>FieldSync</h1>
        <p>Offline-first dispatch and job tracking for field service teams.</p>
        <p>
          <Link href="/sign-in">Sign in</Link> or <Link href="/sign-up">Create an account</Link>.
        </p>
      </main>
    );
  }

  const me = await fetchMe(await getToken());
  if (me.error === 'API unavailable') {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>FieldSync</h1>
        <p>Signed in, but the API is unavailable right now. Start the API on :3001 and refresh.</p>
      </main>
    );
  }
  if (me.status === 404) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>FieldSync</h1>
        <p>Your account isn&apos;t linked to a company yet.</p>
        <p>How access works: first create an account (sign up), then a company admin must invite you and link your account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.</p>
      </main>
    );
  }
  const user = me.data as { name?: string; email?: string; role?: string; company?: { name?: string } } | null;
  return (
    <main style={{ padding: '2rem' }}>
      <h1>FieldSync</h1>
      <p>
        Welcome, {user?.name ?? 'there'} ({user?.email ?? ''}).
      </p>
      <p>
        Role: {user?.role ?? '—'} · Company: {user?.company?.name ?? '—'}
      </p>
      <p>The dispatcher board and technician My Day screens are the next Phase 1 slices.</p>
    </main>
  );
}
