import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import PwaRegister from '../components/PwaRegister';

// Phase 2 PWA: manifest + theme colour + service worker
// registration. Icons are SVG only in this slice (see PR
// body): PNG 192/512 icons are still needed for full Android
// installability and cannot be pushed through the snapshot
// tool, which only handles text files.
export const metadata: Metadata = {
  title: 'FieldSync',
  description: 'Offline-first, real-time dispatch and job tracking for field service teams.',
  manifest: '/manifest.json',
  themeColor: '#0f5132',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link href="/"><strong>FieldSync</strong></Link>
              <SignedIn>
                <Link href="/board">Board</Link>
                <Link href="/my-day">My Day</Link>
                <Link href="/jobs/new">New job</Link>
              </SignedIn>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <PwaRegister />
              <SignedIn>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <SignInButton />
              </SignedOut>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
