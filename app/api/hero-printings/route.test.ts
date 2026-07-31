/**
 * Unit tests for GET /api/hero-printings.
 *
 * The route must resolve every hero's representative printing through ONE
 * batched printingsService.getCardSummariesByUniqueIds call — not a
 * per-hero searchPrintings fan-out (the N+1 that made the deck presenter
 * block ~2-3s on this endpoint).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: {
    getCardSummariesByUniqueIds: vi.fn(),
    searchPrintings: vi.fn(),
  },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { printingsService } from '@/lib/services';
import { HERO_INFO, YOUNG_HERO_INFO } from '@/lib/fab-constants/heroes';

const mockBatch = vi.mocked(printingsService.getCardSummariesByUniqueIds);
const mockSearch = vi.mocked(printingsService.searchPrintings);

function summaryFor(cardUniqueId: string, name: string) {
  return {
    cardUniqueId,
    name,
    types: ['Hero'],
    pitch: null,
    cost: null,
    defense: null,
    power: null,
    health: 40,
    intelligence: 4,
    keywords: [],
    classes: ['Mechanologist'],
    talents: [],
    color: '',
    representativePrintingId: `printing-${name}`,
    representativeImageUrl: `https://img.example/${encodeURIComponent(name)}.webp`,
    printingsCount: 3,
  };
}

function requestFor(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/hero-printings${query}`);
}

describe('GET /api/hero-printings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch.mockResolvedValue({ success: true, data: [] });
  });

  it('resolves all adult heroes with ONE batched service call (no per-hero fan-out)', async () => {
    const adultIds = Object.values(HERO_INFO)
      .map(h => h.cardUniqueId)
      .filter(Boolean);

    await GET(requestFor('?format=adult'));

    expect(mockBatch).toHaveBeenCalledTimes(1);
    const calledIds = mockBatch.mock.calls[0][0];
    expect([...calledIds].sort()).toEqual([...adultIds].sort());
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('maps summaries onto the legacy response shape (name, image_url, stats, slug)', async () => {
    const [heroName, heroInfo] = Object.entries(HERO_INFO).find(
      ([, info]) => info.cardUniqueId
    )!;
    mockBatch.mockResolvedValue({
      success: true,
      data: [summaryFor(heroInfo.cardUniqueId!, heroName)],
    });

    const res = await GET(requestFor('?format=adult'));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    const hero = body.heroes[0];
    expect(hero).toMatchObject({
      name: heroName,
      display_name: heroName,
      heroSlug: heroInfo.shortName,
      health: 40,
      intellect: 4,
      classes: heroInfo.classes,
      talents: heroInfo.talents,
      image_url: `https://img.example/${encodeURIComponent(heroName)}.webp`,
      primary_printing_id: `printing-${heroName}`,
      is_young: false,
    });
  });

  it('marks young-format heroes is_young and queries the young roster', async () => {
    const youngIds = Object.values(YOUNG_HERO_INFO)
      .map(h => h.cardUniqueId)
      .filter(Boolean);
    const [heroName, heroInfo] = Object.entries(YOUNG_HERO_INFO).find(
      ([, info]) => info.cardUniqueId
    )!;
    mockBatch.mockResolvedValue({
      success: true,
      data: [summaryFor(heroInfo.cardUniqueId!, heroName)],
    });

    const res = await GET(requestFor('?format=young'));
    const body = await res.json();

    const calledIds = mockBatch.mock.calls[0][0];
    expect([...calledIds].sort()).toEqual([...youngIds].sort());
    expect(body.heroes[0].is_young).toBe(true);
  });

  it('drops heroes the batch lookup did not resolve instead of failing', async () => {
    const entries = Object.entries(HERO_INFO).filter(([, info]) => info.cardUniqueId);
    const [knownName, knownInfo] = entries[0];
    // Only one of the 57 adult heroes resolves
    mockBatch.mockResolvedValue({
      success: true,
      data: [summaryFor(knownInfo.cardUniqueId!, knownName)],
    });

    const res = await GET(requestFor('?format=adult'));
    const body = await res.json();

    expect(body.count).toBe(1);
    expect(body.heroes[0].name).toBe(knownName);
  });

  it('applies the class filter before querying (smaller id set)', async () => {
    const runeblades = Object.entries(HERO_INFO).filter(([, info]) =>
      info.classes.some(c => c.toLowerCase() === 'runeblade')
    );
    expect(runeblades.length).toBeGreaterThan(0);

    await GET(requestFor('?format=adult&class=runeblade'));

    const calledIds = mockBatch.mock.calls[0][0];
    expect([...calledIds].sort()).toEqual(
      runeblades.map(([, info]) => info.cardUniqueId).filter(Boolean).sort()
    );
  });

  it('sends CDN/browser cache headers (near-static data)', async () => {
    const res = await GET(requestFor('?format=adult'));
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toContain('public');
    expect(cc).toMatch(/s-maxage=\d+/);
  });

  it('returns 500 when the batch lookup fails', async () => {
    mockBatch.mockResolvedValue({ success: false, error: 'db down' });

    const res = await GET(requestFor('?format=adult'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
