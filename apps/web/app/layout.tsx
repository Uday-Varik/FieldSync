import type { ReactNode } from 'react';
import Link from 'next/link';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

// Phase 1: Clerk shell + nav for board, My Day, and new job.
// Map, realtime, and mobile workflow screens come in later phases.
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
            <div>
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
