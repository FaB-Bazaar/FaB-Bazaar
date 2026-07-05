/**
 * Unit tests for Metafy supporter-tier derivation: mapping a user's Metafy
 * community memberships to a 'free' | 'paid' tier by checking membership in the
 * FaB Bazaar community at a paid tier. Pure function — no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSupporterTier,
  fabSupporterTier,
  type MetafyCommunityMembership,
} from './supporter-tier';

const CONFIG = { communityId: 'comm_fab', paidTierIds: ['tier_paid', 'tier_pro'] };

describe('computeSupporterTier', () => {
  it('returns paid when the user holds a paid tier in the FaB community', () => {
    const communities: MetafyCommunityMembership[] = [
      { id: 'comm_fab', title: 'FaB Bazaar', tiers: [{ id: 'tier_paid', name: 'Supporter' }] },
    ];
    expect(computeSupporterTier(communities, CONFIG)).toBe('paid');
  });

  it('returns paid for any configured paid tier id', () => {
    const communities: MetafyCommunityMembership[] = [
      { id: 'comm_fab', tiers: [{ id: 'tier_pro', name: 'Pro' }] },
    ];
    expect(computeSupporterTier(communities, CONFIG)).toBe('paid');
  });

  it('returns free when the user is in the FaB community but only on a non-paid tier', () => {
    const communities: MetafyCommunityMembership[] = [
      { id: 'comm_fab', tiers: [{ id: 'tier_free', name: 'Follower' }] },
    ];
    expect(computeSupporterTier(communities, CONFIG)).toBe('free');
  });

  it('returns free when the user is not a member of the FaB community', () => {
    const communities: MetafyCommunityMembership[] = [
      { id: 'comm_other', tiers: [{ id: 'tier_paid', name: 'Supporter' }] },
    ];
    expect(computeSupporterTier(communities, CONFIG)).toBe('free');
  });

  it('returns free when the FaB community has no tiers', () => {
    const communities: MetafyCommunityMembership[] = [{ id: 'comm_fab', tiers: [] }];
    expect(computeSupporterTier(communities, CONFIG)).toBe('free');
  });

  it('returns free for empty, null, or undefined membership lists', () => {
    expect(computeSupporterTier([], CONFIG)).toBe('free');
    expect(computeSupporterTier(null, CONFIG)).toBe('free');
    expect(computeSupporterTier(undefined, CONFIG)).toBe('free');
  });

  it('tolerates a community with null tiers', () => {
    const communities: MetafyCommunityMembership[] = [{ id: 'comm_fab', tiers: null }];
    expect(computeSupporterTier(communities, CONFIG)).toBe('free');
  });
});

describe('fabSupporterTier (real-constants wrapper)', () => {
  it('defaults to free until the real FaB community/tier ids are configured', () => {
    // Guards the fail-safe: an unconfigured (empty) constant must never grant paid.
    expect(fabSupporterTier([])).toBe('free');
  });
});
