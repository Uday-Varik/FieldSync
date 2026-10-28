import type { ReactNode } from 'react';

// Required by Next.js App Router. Phase 1 replaces this placeholder
// shell with the real app layout (nav by role, sync status bar).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
