import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import './globals.css';
import AppShell from '../components/AppShell';
import { fetchMe } from '../lib/api';

// Phase 2 PWA: manifest + theme colour + service worker
// registration (see PwaRegister). Icons are SVG only in this
// slice (see PR body): PNG 192/512 icons are still needed for
// full Android installability and cannot be pushed through
// the snapshot tool, which only handles text files.
export const metadata: Metadata = {
  title: 'FieldSync',
  description: 'Offline-first, real-time dispatch and job tracking for field service teams.',
  manifest: '/manifest.json',
  themeColor: '#0f5132',
};

// Human role labels for the shell context line. Unknown role
// values render no label rather than a raw code.
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
  TECHNICIAN: 'Technician',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Shell context only: company name + role for the header.
  // The /me fetch never breaks the shell — an unavailable or
  // unlinked account renders the shell without context, and
  // each page keeps its own signed-in / unlinked / API-down
  // states. "New job" is hidden in the nav for technicians,
  // matching the refusal on the page itself; when the role is
  // unknown (API down, unlinked) the link stays, as before —
  // the page guard is unchanged.
  const { userId, getToken } = await auth();
  let companyName: string | null = null;
  let roleLabel: string | null = null;
  let showNewJob = true;
  if (userId) {
    try {
      const me = await fetchMe(await getToken());
      const data = me.data as {
        role?: string;
        company?: { name?: string };
      } | null;
      companyName = data?.company?.name ?? null;
      roleLabel = data?.role ? (ROLE_LABELS[data.role] ?? null) : null;
      showNewJob = data?.role !== 'TECHNICIAN';
    } catch {
      // Shell renders without context; pages report their own state.
    }
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <AppShell
            companyName={companyName}
            roleLabel={roleLabel}
            showNewJob={showNewJob}
          >
            {children}
          </AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
