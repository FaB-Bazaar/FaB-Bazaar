/**
 * Unit tests for the in-memory pending-confirmation registry that bridges the
 * agent loop's ConfirmationGate.wait to the confirm endpoint. Per-container
 * (same caveat as rate limiting) — fine while the app is one container.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitForConfirmation, resolveConfirmation } from './confirmations';

afterEach(() => {
  vi.useRealTimers();
});

describe('confirmation registry', () => {
  it('resolves the waiting promise with the decision', async () => {
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1' });
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(true);
    await expect(pending).resolves.toBe('confirm');
  });

  it('passes deny through', async () => {
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1' });
    expect(resolveConfirmation('u1', 'c1', 'deny')).toBe(true);
    await expect(pending).resolves.toBe('deny');
  });

  it('rejects a resolve from a different user — the pending entry survives', async () => {
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1' });
    expect(resolveConfirmation('attacker', 'c1', 'confirm')).toBe(false);
    expect(resolveConfirmation('u1', 'c1', 'deny')).toBe(true);
    await expect(pending).resolves.toBe('deny');
  });

  it('returns false for an unknown id', () => {
    expect(resolveConfirmation('u1', 'nope', 'confirm')).toBe(false);
  });

  it('a second resolve is a no-op returning false', async () => {
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1' });
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(true);
    expect(resolveConfirmation('u1', 'c1', 'deny')).toBe(false);
    await expect(pending).resolves.toBe('confirm');
  });

  it('times out to deny', async () => {
    vi.useFakeTimers();
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1', timeoutMs: 5_000 });
    vi.advanceTimersByTime(5_001);
    await expect(pending).resolves.toBe('deny');
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(false); // cleaned up
  });

  it('abort resolves deny and cleans up', async () => {
    const ac = new AbortController();
    const pending = waitForConfirmation({ userId: 'u1', id: 'c1', signal: ac.signal });
    ac.abort();
    await expect(pending).resolves.toBe('deny');
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(false);
  });

  it('an already-aborted signal resolves deny immediately', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(waitForConfirmation({ userId: 'u1', id: 'c1', signal: ac.signal })).resolves.toBe('deny');
  });

  it('re-registering the same user+id denies the stale entry instead of orphaning it', async () => {
    const first = waitForConfirmation({ userId: 'u1', id: 'c1' });
    const second = waitForConfirmation({ userId: 'u1', id: 'c1' });
    await expect(first).resolves.toBe('deny');
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(true);
    await expect(second).resolves.toBe('confirm');
  });

  it('same call id under different users are independent entries', async () => {
    const a = waitForConfirmation({ userId: 'u1', id: 'c1' });
    const b = waitForConfirmation({ userId: 'u2', id: 'c1' });
    expect(resolveConfirmation('u1', 'c1', 'confirm')).toBe(true);
    expect(resolveConfirmation('u2', 'c1', 'deny')).toBe(true);
    await expect(a).resolves.toBe('confirm');
    await expect(b).resolves.toBe('deny');
  });
});
