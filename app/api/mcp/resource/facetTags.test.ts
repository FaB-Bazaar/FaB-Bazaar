/**
 * fab://facet-tags — DB-derived curated facet vocabulary (id + definition per
 * dimension). The definitions are load-bearing: the model can only pick
 * correct facetTags[] values if it can read what each tag MEANS (e.g.
 * pitch-stack = bottom-of-deck ordering, not resource generation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FacetTagDefinitionWithCount } from '@/lib/services/contracts/IFacetService';

// Mocks must be declared before importing the module under test (vi.mock is hoisted).
vi.mock('@/lib/services', () => ({
  facetService: { getTagUsageCounts: vi.fn() },
}));
vi.mock('@/lib/redis', () => ({ getRedisClient: vi.fn() }));

import { groupFacetTagsByDim, facetTagsResource } from './facetTags';
import { facetService } from '@/lib/services';
import { getRedisClient } from '@/lib/redis';

const mockGetCounts = vi.mocked(facetService.getTagUsageCounts);
const mockGetRedis = vi.mocked(getRedisClient);

function tag(partial: Partial<FacetTagDefinitionWithCount>): FacetTagDefinitionWithCount {
  return {
    id: 'placeholder',
    dim: 'mechanical',
    label: 'Placeholder',
    def: 'A placeholder definition.',
    draft: false,
    cardCount: 0,
    ...partial,
  };
}

const TAGS: FacetTagDefinitionWithCount[] = [
  tag({ id: 'pitch-stack', dim: 'strategic', def: 'Pitch to the BOTTOM of the deck to order future draws.', cardCount: 3 }),
  tag({ id: 'combo-enabler', dim: 'mechanical', def: 'Assembles a combo line.', cardCount: 12 }),
  tag({ id: 'flood-line', dim: 'synergy', def: 'Finisher: Flood of Force.', cardCount: 4 }),
  tag({ id: 'half-baked-idea', dim: 'mechanical', def: 'Not ready.', draft: true, cardCount: 0 }),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRedis.mockReturnValue(null as any);
  mockGetCounts.mockResolvedValue({ success: true, data: TAGS } as any);
});

describe('groupFacetTagsByDim', () => {
  it('groups non-draft tags by dimension with id, definition, and card count', () => {
    const grouped = groupFacetTagsByDim(TAGS);
    expect(grouped.mechanical).toEqual([
      { id: 'combo-enabler', def: 'Assembles a combo line.', cards: 12 },
    ]);
    expect(grouped.strategic).toEqual([
      { id: 'pitch-stack', def: 'Pitch to the BOTTOM of the deck to order future draws.', cards: 3 },
    ]);
    expect(grouped.synergy).toEqual([
      { id: 'flood-line', def: 'Finisher: Flood of Force.', cards: 4 },
    ]);
  });

  it('excludes draft tags — they are not yet part of the searchable vocabulary', () => {
    const grouped = groupFacetTagsByDim(TAGS);
    const allIds = Object.values(grouped).flat().map((t) => t.id);
    expect(allIds).not.toContain('half-baked-idea');
  });
});

describe('facetTagsResource', () => {
  it('is addressed as fab://facet-tags', () => {
    expect(facetTagsResource.uri).toBe('fab://facet-tags');
  });

  it('returns the grouped vocabulary with usage guidance naming the facetTags filter', async () => {
    const payload = await facetTagsResource.handler();
    expect(payload._usage).toContain('facetTags');
    expect(payload.tags.mechanical.map((t: any) => t.id)).toContain('combo-enabler');
  });

  it('degrades to an empty vocabulary on a service failure instead of throwing', async () => {
    mockGetCounts.mockResolvedValue({ success: false, error: 'db down' } as any);
    const payload = await facetTagsResource.handler();
    expect(payload.tags).toEqual({ mechanical: [], strategic: [], synergy: [] });
  });
});
