// lib/profile/public-profile-cache.ts
//
// Short in-memory cache of the public profile lookup (username → user + stats)
// behind GET /api/users/profile/[username]. Kept on globalThis because Next
// loads separate module copies per route handler: the routes that EDIT a
// profile must be able to drop the entry the profile route reads.
//
// Per-container, like the other in-memory caches (single nextjs container).

const TTL_MS = 5 * 60 * 1000; // matches the profile response's Cache-Control max-age

interface Entry {
  data: unknown;
  expiry: number;
}

const store: Map<string, Entry> = ((globalThis as any).__publicProfileCache ??= new Map<string, Entry>());

const keyOf = (username: string) => username.trim().toLowerCase();

export function getCachedPublicProfile<T = any>(username: string): T | null {
  const key = keyOf(username);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedPublicProfile(username: string, data: unknown): void {
  // Sweep expired entries on write so the map cannot grow without bound.
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiry) store.delete(key);
  }
  store.set(keyOf(username), { data, expiry: now + TTL_MS });
}

/** Call after a user edits anything their public profile shows. */
export function invalidatePublicProfile(username: string | null | undefined): void {
  if (username) store.delete(keyOf(username));
}
