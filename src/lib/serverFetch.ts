import { cookies, headers } from 'next/headers';

/**
 * Server-side fetch helper that calls internal API routes with the
 * current user's auth cookies forwarded. This allows prefetchQuery
 * calls in Server Components to hit authenticated API routes.
 *
 * Returns parsed JSON on success, or null on failure (so prefetch
 * gracefully falls back to client-side fetching).
 */
export async function serverFetch(path: string) {
  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const url = `${protocol}://${host}${path}`;

    const res = await fetch(url, {
      headers: {
        Cookie: cookieStore.toString(),
      },
      cache: 'no-store', // Always fetch fresh from API during SSR
    });

    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    // Silently fail — client component will re-fetch via useQuery
    console.error('[serverFetch] Prefetch failed for', path, error);
    return null;
  }
}
