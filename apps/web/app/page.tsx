import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { fetchMe } from '../lib/api';
import PageHeader from '../components/ui/PageHeader';
import { SyncBadge } from '../components/ui/SyncBadge';
import styles from './page.module.css';

// Homepage (docs/17 slice (d), §1.2). Signed-out visitors
// get what FieldSync is and who it is for, in the README's
// own words only — no invented claims, metrics, or
// features — plus the sign-in / create-account paths and
// the PR #47 sign-up/invite rules. Signed-in users get
// their role and company in human labels (never raw role
// codes) and role-aware links to the screens they already
// use: Board, My Day, and Map for every role, and New job
// for every role except Technician, matching the shell's
// nav rule and the refusal on the new-job page itself.
// The stale "next Phase 1 slices" copy is removed: the
// board and My Day screens exist. The developer-facing
// "Start the API on :3001" error text is replaced with the
// plain-language retry state the board and My Day already
// use. Data fetching and the /me branches are unchanged,
// except the unlinked branch now also matches the
// USER_NOT_LINKED error code (PR #47) instead of only a
// 404, so a signed-in user whose account is not linked
// sees the rules even when the API reports it as a 403.
// Human role labels mirror the shell (layout.tsx);
// unknown role values render no role line rather than a
// raw code.
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
  TECHNICIAN: 'Technician',
};

export default async function Home() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="FieldSync"
          supporting="Offline-first dispatch and job tracking for field service teams."
        />
        <div className={styles.intro}>
          <p>
            A dispatcher creates and assigns jobs on a desktop board; technicians work them on a phone, including
            fully offline, and everything reconciles when the phone comes back online.
          </p>
        </div>
        <p className={styles.actions}>
          <Link href="/sign-in" className={styles.primaryLink}>
            Sign in
          </Link>
          <Link href="/sign-up" className={styles.secondaryLink}>
            Create an account
          </Link>
        </p>
        <ul className={styles.featureList}>
          <li>Board: jobs grouped by status, with search and status filter, updating live over Socket.io.</li>
          <li>My Day: a technician&apos;s assigned jobs for today.</li>
          <li>Map: today&apos;s jobs on Mapbox, with server-side geocoding on create (best-effort) and client-side fallback.</li>
          <li>
            Offline-first: status, checklist, notes, and photos queue in an IndexedDB outbox and sync in order when
            connectivity returns. A job never opened online is not guaranteed offline.
          </li>
          <li>Roles: Admin, Dispatcher, Technician. Technicians see assigned jobs only.</li>
        </ul>
        <p className={styles.rules}>
          How access works: first create an account (sign up), then a company admin must invite you and link your
          account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.
        </p>
      </main>
    );
  }

  const me = await fetchMe(await getToken());
  if (me.error === 'API unavailable') {
    return (
      <main className={styles.page}>
        <PageHeader title="FieldSync" />
        <p>FieldSync couldn&apos;t be loaded right now. The service isn&apos;t responding — try again.</p>
        <p>
          <Link href="/" className={styles.secondaryLink}>
            Retry
          </Link>
        </p>
      </main>
    );
  }
  if (me.errorCode === 'USER_NOT_LINKED' || me.status === 404) {
    return (
      <main className={styles.page}>
        <PageHeader title="FieldSync" />
        <p>Your account isn&apos;t linked to a company yet.</p>
        <p>
          How access works: first create an account (sign up), then a company admin must invite you and link your
          account. Signing in alone doesn&apos;t grant access — jobs appear only after your account is linked.
        </p>
      </main>
    );
  }
  const user = me.data as { name?: string; email?: string; role?: string; company?: { name?: string } } | null;
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? null) : null;
  const isTechnician = user?.role === 'TECHNICIAN';
  const navLinks = isTechnician
    ? [
        { href: '/my-day', label: 'My Day' },
        { href: '/board', label: 'Board' },
        { href: '/map', label: 'Map' },
      ]
    : [
        { href: '/board', label: 'Board' },
        { href: '/my-day', label: 'My Day' },
        { href: '/map', label: 'Map' },
        { href: '/jobs/new', label: 'New job' },
      ];
  const context = [roleLabel, user?.company?.name].filter(Boolean).join(' · ');

  return (
    <main className={styles.page}>
      <PageHeader title="FieldSync" supporting={`Welcome, ${user?.name ?? 'there'}.`}>
        <SyncBadge />
      </PageHeader>
      <section className={styles.card} aria-label="Your account">
        <p className={styles.cardName}>{user?.name ?? 'Signed in'}</p>
        <p className={styles.cardMeta}>
          {user?.email ?? ''}
          {context ? ` · ${context}` : ''}
        </p>
      </section>
      <h2 className={styles.sectionTitle}>Continue to</h2>
      <ul className={styles.navList}>
        {navLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.secondaryLink}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
