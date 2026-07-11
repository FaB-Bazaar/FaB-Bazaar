// app/api/mcp/resource/facetTags.ts
//
// fab://facet-tags — DB-derived curated facet vocabulary: what a card DOES /
// enables / plays with (the interpretive layer the raw card data can't answer).
// Values here are the ONLY valid inputs for search_printings' facetTags[]
// filter. Definitions are load-bearing — tag ids alone mislead (pitch-stack is
// bottom-of-deck ordering, not resource generation).
//
// Source of truth is the `facet_tag_definitions` table (admin content manager
// at /admin/card-facets), NEVER the seed array in lib/search/card-facets.ts —
// the vocabulary grows with every curation session. Draft tags are excluded:
// they are not yet part of the searchable vocabulary.

import { getRedisClient } from '@/lib/redis';
import type { FacetDimension, FacetTagDefinitionWithCount } from '@/lib/services/contracts/IFacetService';

const CACHE_KEY = 'mcp:facet-tags:v1';
const CACHE_TTL_SECONDS = 3600; // 1h — curation sessions should surface same-day

interface FacetTagEntry {
  id: string; // pass to search_printings facetTags[]
  def: string;
  cards: number; // how many cards carry the tag today (coverage signal)
}

type FacetTagsByDim = Record<FacetDimension, FacetTagEntry[]>;

const DIMENSIONS: FacetDimension[] = ['mechanical', 'strategic', 'synergy'];

/**
 * Pure grouping: bucket non-draft tag definitions by dimension, keeping the
 * definition text and per-tag card count (so the model can calibrate coverage
 * expectations — a 0-card tag can't return results yet).
 */
export function groupFacetTagsByDim(rows: FacetTagDefinitionWithCount[]): FacetTagsByDim {
  const result = { mechanical: [], strategic: [], synergy: [] } as FacetTagsByDim;
  for (const dim of DIMENSIONS) {
    result[dim] = rows
      .filter((r) => r.dim === dim && !r.draft)
      .map((r) => ({ id: r.id, def: r.def, cards: r.cardCount }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}

async function buildPayload() {
  // Lazy import to keep this off the service-layer circular-dep graph (see CLAUDE.md).
  const { facetService } = await import('@/lib/services');
  const result = await facetService.getTagUsageCounts();
  const rows = result.success ? result.data : [];

  return {
    _source:
      'Derived live from the facet_tag_definitions table (curated at /admin/card-facets) — the vocabulary grows over time; never hardcode these ids.',
    _usage:
      'Search by function with search_printings → filters.facetTags: ["<id>", ...] (matches cards carrying ANY listed tag; composes with heroLegal/format/price/etc.). Read the def before picking a tag — ids alone mislead. Coverage is curated and growing: `cards` is how many cards carry the tag today, and an empty search result means "no TAGGED cards match", not "no cards do this".',
    dimensions: {
      mechanical: 'What the card\'s text does (observable on the card)',
      strategic: 'How the card is used / what it\'s good against (not on the card)',
      synergy: 'Named packages, name-groups, and combo lines the card plays with',
    },
    tags: groupFacetTagsByDim(rows),
  };
}

export const facetTagsResource = {
  type: 'resource' as const,
  uri: 'fab://facet-tags',
  name: 'facet_tag_vocabulary',
  description:
    'Curated card-function tag vocabulary (what a card DOES / enables / counters) with definitions and coverage counts. Required before using the facetTags[] filter in search_printings.',
  mimeType: 'application/json',

  handler: async () => {
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        console.error('[facet-tags] Redis read error:', err);
      }
    }

    const payload = await buildPayload();

    if (redis) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
      } catch (err) {
        console.error('[facet-tags] Redis write error:', err);
      }
    }

    return payload;
  },
};
