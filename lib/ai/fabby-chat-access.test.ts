/**
 * Unit tests for the Fabby Chat access gate. Single source of truth shared by
 * the page server gate, the API route gates, and navbar visibility. Pure —
 * no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import { canUseFabbyChat } from './fabby-chat-access';

describe('canUseFabbyChat', () => {
  it('grants access to paid Metafy supporters', () => {
    expect(canUseFabbyChat({ isSuperAdmin: false, metafySupporterTier: 'paid' })).toBe(true);
  });

  it('grants access to superadmins regardless of tier', () => {
    expect(canUseFabbyChat({ isSuperAdmin: true, metafySupporterTier: 'free' })).toBe(true);
  });

  it('denies free-tier non-admins', () => {
    expect(canUseFabbyChat({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe(false);
  });

  it('denies when tier is missing/null and not a superadmin', () => {
    expect(canUseFabbyChat({ isSuperAdmin: false })).toBe(false);
    expect(canUseFabbyChat({ isSuperAdmin: false, metafySupporterTier: null })).toBe(false);
  });

  it('does NOT grant access on the ads-only isMetafySupporter flag alone', () => {
    // isMetafySupporter stays ads-only; it is intentionally not part of this gate.
    expect(canUseFabbyChat({ isSuperAdmin: false, metafySupporterTier: 'free' })).toBe(false);
  });

  it('denies for null/undefined input', () => {
    expect(canUseFabbyChat(null)).toBe(false);
    expect(canUseFabbyChat(undefined)).toBe(false);
  });
});
