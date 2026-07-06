/**
 * Unit tests for the Volzar access gate. Single source of truth shared by
 * the page server gate, the API route gates, and navbar visibility. Pure —
 * no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import { canUseVolzar } from './volzar-access';

describe('canUseVolzar', () => {
  it('grants access to paid Metafy supporters', () => {
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'paid' })).toBe(true);
  });

  it('grants access to superadmins regardless of tier', () => {
    expect(canUseVolzar({ isSuperAdmin: true, metafySupporterTier: 'free' })).toBe(true);
  });

  it('grants access via a manual volzarAccess grant (no Metafy required)', () => {
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'free', volzarAccess: true })).toBe(true);
  });

  it('denies free-tier non-admins', () => {
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe(false);
  });

  it('denies when tier is missing/null and not a superadmin', () => {
    expect(canUseVolzar({ isSuperAdmin: false })).toBe(false);
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: null })).toBe(false);
  });

  it('does NOT grant access on the ads-only isMetafySupporter flag alone', () => {
    // isMetafySupporter stays ads-only; it is intentionally not part of this gate.
    expect(canUseVolzar({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe(false);
  });

  it('denies for null/undefined input', () => {
    expect(canUseVolzar(null)).toBe(false);
    expect(canUseVolzar(undefined)).toBe(false);
  });
});
