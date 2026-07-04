// In-memory registry of destructive-tool confirmations awaiting a user
// decision. The agent loop's ConfirmationGate.wait parks here; the confirm
// endpoint resolves the entry from a second HTTP request.
//
// Per-container state (same caveat as lib/rate-limit): genuinely global only
// because the app runs a single nextjs container. Scaling out means the
// confirm POST could land on a different instance than the SSE stream — move
// this to Redis pub/sub first.

import type { ConfirmationDecision } from './types';

const DEFAULT_TIMEOUT_MS = 5 * 60_000; // user walked away → deny, free the stream

// Anchored on globalThis: the chat route and the confirm route are separate
// Next bundles, so a plain module-level Map can be instantiated once per
// bundle (and again on dev HMR) — the confirm POST would then look into an
// empty copy and 404. One process must mean one registry.
const globalStore = globalThis as unknown as {
  __fabbyPendingConfirmations?: Map<string, (decision: ConfirmationDecision) => void>;
};
const pending = (globalStore.__fabbyPendingConfirmations ??= new Map());

// Keyed by authenticated user + tool call id: a resolve can never touch
// another user's pending call, and call ids only need to be unique per user.
const keyFor = (userId: string, id: string) => `${userId}:${id}`;

/**
 * Register a pending confirmation and wait for its decision. Never rejects:
 * timeout, abort, and displacement by a duplicate registration all resolve
 * 'deny' (the safe direction for a destructive call).
 */
export function waitForConfirmation(opts: {
  userId: string;
  id: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ConfirmationDecision> {
  const { userId, id, signal } = opts;
  const key = keyFor(userId, id);

  if (signal?.aborted) return Promise.resolve('deny');

  // A stale entry under the same key (e.g. the same user re-ran a turn whose
  // LLM reused a call id) can never be resolved again — deny it out.
  pending.get(key)?.('deny');

  return new Promise<ConfirmationDecision>((resolve) => {
    const timer = setTimeout(() => finish('deny'), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    (timer as { unref?: () => void }).unref?.();

    const onAbort = () => finish('deny');

    function finish(decision: ConfirmationDecision) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      // Only delete our own entry — a newer registration may own the key now.
      if (pending.get(key) === finish) pending.delete(key);
      resolve(decision);
    }

    signal?.addEventListener('abort', onAbort);
    pending.set(key, finish);
  });
}

/**
 * Resolve a pending confirmation for the authenticated user. Returns false if
 * nothing is waiting under that id (unknown, expired, or another user's).
 */
export function resolveConfirmation(
  userId: string,
  id: string,
  decision: ConfirmationDecision,
): boolean {
  const finish = pending.get(keyFor(userId, id));
  if (!finish) return false;
  finish(decision);
  return true;
}
