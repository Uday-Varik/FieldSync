'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

// Phase 3 live board: connects to the API's Socket.io
// gateway with the Clerk session token, and refreshes
// the server-rendered board whenever a job:updated
// event arrives for this company. That is the live
// latency path: status change -> emit -> refresh, in
// well under 2 seconds on a local network, without a
// manual refresh. Presence shows who else is online.
// If the API or socket is down, the board still works
// as a normal (manual-refresh) page — live is additive,
// not required.
export default function LiveBoard() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [online, setOnline] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      socket = io(base, { auth: { token }, transports: ['websocket', 'polling'] });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on('job:updated', () => router.refresh());
      socket.on('presence', (data: { users?: { name: string }[] }) => {
        setOnline((data.users ?? []).map((u) => u.name));
      });
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [getToken, router]);

  return (
    <p style={{ fontSize: '0.9rem' }}>
      {connected ? '● Live' : '○ Live unavailable (manual refresh still works)'}
      {online.length > 0 && ` · Online: ${online.join(', ')}`}
    </p>
  );
}
