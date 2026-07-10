/**
 * Unit tests for the Volzar access gate. Single source of truth shared by
 * the page server gate, the API route gates, and navbar visibility. Pure —
 * no DB, no HTTP.
 *
 * Volzar is standard for all signed-in users (2026-07): the gate now only
 * distinguishes "signed in" (flags object present) from "signed out"
 * (null/undefined). Cost control moved to per-user + global daily message
 * limits (lib/ai/tiers.ts).
 */

import { describe, it, expect } from 'vitest';
import { canUseVolzar } from './volzar-access';

describe('canUseVolzar', () => {
  it('grants access to any signed-in user, regardless of tier or grants', () => {
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe(true);
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: null })).toBe(true);
    expect(canUseVolzar({ isSuperAdmin: false })).toBe(true);
  });

  it('still grants access to the old cohorts (supporters, superadmins, manual grants)', () => {
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'paid' })).toBe(true);
    expect(canUseVolzar({ isSuperAdmin: true, metafySupporterTier: 'free' })).toBe(true);
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'free', volzarAccess: true })).toBe(true);
  });

  it('denies signed-out callers (null/undefined flags)', () => {
    expect(canUseVolzar(null)).toBe(false);
    expect(canUseVolzar(undefined)).toBe(false);
  });
});
