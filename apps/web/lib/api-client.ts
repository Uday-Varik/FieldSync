'use client';

/**
 * Client-side API calls, used by forms (create, status, assign).
 * The token comes from Clerk's useAuth() in the calling component,
 * never from a stored or hard-coded value.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiCall(token: string | null, path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `API error (${res.status})`);
  }
  return data;
}
