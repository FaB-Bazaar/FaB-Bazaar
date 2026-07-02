/**
 * Unit tests for the trade-interest notification dedupe window.
 *
 * In-memory, per-process — mirrors the app's other in-memory rate limits
 * (single `nextjs` container, see CLAUDE.md "Search rate limiting").
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldNotifyTradeInterest,
  resetTradeInterestDedupe,
  TRADE_INTEREST_DEDUPE_WINDOW_MS,
} from './trade-interest-dedupe';

const T0 = 1_750_000_000_000; // fixed epoch base so tests are deterministic

beforeEach(() => {
  resetTradeInterestDedupe();
});

describe('shouldNotifyTradeInterest', () => {
  it('allows the first notification for a requester+binder pair', () => {
    expect(shouldNotifyTradeInterest('user-1', 'binder-a', T0)).toBe(true);
  });

  it('suppresses a repeat within the dedupe window', () => {
    shouldNotifyTradeInterest('user-1', 'binder-a', T0);
    expect(shouldNotifyTradeInterest('user-1', 'binder-a', T0 + 1000)).toBe(false);
  });

  it('allows again after the window has elapsed', () => {
    shouldNotifyTradeInterest('user-1', 'binder-a', T0);
    expect(
      shouldNotifyTradeInterest('user-1', 'binder-a', T0 + TRADE_INTEREST_DEDUPE_WINDOW_MS + 1)
    ).toBe(true);
  });

  it('tracks requester+binder pairs independently', () => {
    shouldNotifyTradeInterest('user-1', 'binder-a', T0);
    expect(shouldNotifyTradeInterest('user-2', 'binder-a', T0)).toBe(true);
    expect(shouldNotifyTradeInterest('user-1', 'binder-b', T0)).toBe(true);
  });

  it('a suppressed attempt does not extend the window', () => {
    shouldNotifyTradeInterest('user-1', 'binder-a', T0);
    // hammering the button near the end of the window...
    shouldNotifyTradeInterest('user-1', 'binder-a', T0 + TRADE_INTEREST_DEDUPE_WINDOW_MS - 5);
    // ...must not push the expiry out
    expect(
      shouldNotifyTradeInterest('user-1', 'binder-a', T0 + TRADE_INTEREST_DEDUPE_WINDOW_MS + 1)
    ).toBe(true);
  });
});
