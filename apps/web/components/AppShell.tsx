'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from '@clerk/nextjs';
import PwaRegister from './PwaRegister';
import OfflineBanner from './OfflineBanner';
import styles from './AppShell.module.css';

// App shell (docs/17 §3.2): brand, role-aware primary nav,
// company/role context, user menu, and the offline/sync slot.
// Same links, same Clerk components, same OfflineBanner
// placement as the previous layout.tsx header — presentation
// only. The shell has no <h1>: each page keeps its own page
// title as the single heading for that page.
//
// Offline/sync status is always mounted here via OfflineBanner
// (it renders nothing while online with nothing pending —
// that is its designed behaviour, and the shell never hides
// it). Per-job conflict/rejection notices (SyncNotices) stay
// on the job detail page: they need a jobId and cannot live
// in the shell.
//
// Signed-out users see the same shell minus the role nav
// (brand + sign-in). The sign-in/sign-up pages therefore
// render inside the unauthenticated variant with no change
// to Clerk flows.

const NAV_LINKS = [
  { href: '/board', label: 'Board' },
  { href: '/my-day', label: 'My Day' },
  { href: '/map', label: 'Map' },
] as const;

export default function AppShell({
  children,
  companyName,
  roleLabel,
  showNewJob,
}: {
  children: React.ReactNode;
  companyName: string | null;
  roleLabel: string | null;
  showNewJob: boolean;
}) {
  const pathname = usePathname();
  const context =
    [companyName, roleLabel].filter(Boolean).join(' · ') || null;

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandBlock}>
            <Link
              href="/"
              className={styles.wordmark}
              aria-current={pathname === '/' ? 'page' : undefined}
            >
              FieldSync
            </Link>
            <SignedIn>
              {context ? <p className={styles.context}>{context}</p> : null}
            </SignedIn>
          </div>
          <SignedIn>
            <nav className={styles.nav} aria-label="Primary">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={styles.navLink}
                  aria-current={
                    pathname === link.href ? 'page' : undefined
                  }
                >
                  {link.label}
                </Link>
              ))}
              {showNewJob ? (
                <Link
                  href="/jobs/new"
                  className={styles.navLink}
                  aria-current={
                    pathname === '/jobs/new' ? 'page' : undefined
                  }
                >
                  New job
                </Link>
              ) : null}
            </nav>
          </SignedIn>
          <div className={styles.actions}>
            <PwaRegister />
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton />
            </SignedOut>
          </div>
        </div>
      </header>
      <OfflineBanner />
      <div id="main-content" className={styles.content} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
