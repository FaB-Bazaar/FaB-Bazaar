import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HeroLegalityRow } from '@/lib/services/contracts/IPrintingsService';

// Mocks must be declared before importing the module under test (vi.mock is hoisted).
vi.mock('@/lib/services', () => ({
  printingsService: { listHeroCards: vi.fn() },
}));
vi.mock('@/lib/redis', () => ({ getRedisClient: vi.fn() }));

import { groupHeroesByFormat, heroesByFormatResource } from './heroesByFormat';
import { printingsService } from '@/lib/services';
import { getRedisClient } from '@/lib/redis';

const mockListHeroCards = vi.mocked(printingsService.listHeroCards);
const mockGetRedis = vi.mocked(getRedisClient);

function row(partial: Partial<HeroLegalityRow>): HeroLegalityRow {
  return {
    cardUniqueId: 'x',
    name: 'placeholder',
    displayName: 'Placeholder',
    imageUrl: null,
    types: ['hero'],
    klass: null,
    ccLegal: false,
    futureCcLegal: false,
    blitzLegal: false,
    silverAgeLegal: false,
    commonerLegal: false,
    llLegal: false,
    ...partial,
  };
}

const ROWS: HeroLegalityRow[] = [
  row({
    cardUniqueId: 'y', name: 'oldhim', displayName: 'Oldhim',
    types: ['elemental', 'guardian', 'hero', 'young'], klass: 'guardian',
    blitzLegal: true, silverAgeLegal: true, commonerLegal: true,
  }),
  row({
    cardUniqueId: 'a', name: 'oldhim, grandfather of eternity',
    displayName: 'Oldhim, Grandfather of Eternity',
    types: ['elemental', 'guardian', 'hero'], klass: 'guardian', llLegal: true,
  }),
  row({
    cardUniqueId: 'b', name: 'briar, warden of thorns',
    displayName: 'Briar, Warden of Thorns',
    types: ['elemental', 'runeblade', 'hero'], klass: 'runeblade', ccLegal: true,
  }),
];

describe('groupHeroesByFormat', () => {
  it('exposes all six formats, each split into adult and young arrays', () => {
    const grouped = groupHeroesByFormat(ROWS);
    for (const fmt of ['cc', 'future_cc', 'blitz', 'silver_age', 'commoner', 'll'] as const) {
      expect(grouped[fmt]).toBeDefined();
      expect(Array.isArray(grouped[fmt].adult)).toBe(true);
      expect(Array.isArray(grouped[fmt].young)).toBe(true);
    }
  });

  it('places young Oldhim under silver_age.young (and never under silver_age.adult)', () => {
    const grouped = groupHeroesByFormat(ROWS);
    expect(grouped.silver_age.young.map(h => h.name)).toContain('oldhim');
    expect(grouped.silver_age.adult.map(h => h.name)).not.toContain('oldhim');
  });

  it('places adult Oldhim under ll.adult only', () => {
    const grouped = groupHeroesByFormat(ROWS);
    expect(grouped.ll.adult.map(h => h.name)).toContain('oldhim, grandfather of eternity');
    expect(grouped.ll.young).toHaveLength(0);
  });

  it('excludes heroes from formats they are not legal in', () => {
    const grouped = groupHeroesByFormat(ROWS);
    // Both Oldhims are cc_legal:false; only Briar is cc_legal:true
    expect(grouped.cc.adult.map(h => h.name)).toEqual(['briar, warden of thorns']);
    expect(grouped.cc.young).toHaveLength(0);
  });

  it('emits lean entries (lowercase name for heroLegal, displayName, classes)', () => {
    const grouped = groupHeroesByFormat(ROWS);
    expect(grouped.silver_age.young[0]).toEqual({
      name: 'oldhim',
      displayName: 'Oldhim',
      classes: ['guardian'],
    });
  });
});

describe('heroesByFormatResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advertises the fab://heroes-by-format URI', () => {
    expect(heroesByFormatResource.uri).toBe('fab://heroes-by-format');
  });

  it('derives from the DB when Redis is unavailable', async () => {
    mockGetRedis.mockReturnValue(null);
    mockListHeroCards.mockResolvedValue({ success: true, data: ROWS } as any);

    const data: any = await heroesByFormatResource.handler();

    expect(mockListHeroCards).toHaveBeenCalledOnce();
    expect(data.formats.silver_age.young.map((h: any) => h.name)).toContain('oldhim');
  });

  it('returns cached payload without hitting the service on a cache hit', async () => {
    const cached = JSON.stringify({ formats: { silver_age: { young: [{ name: 'cachedhero' }] } } });
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(cached), set: vi.fn() } as any);

    const data: any = await heroesByFormatResource.handler();

    expect(mockListHeroCards).not.toHaveBeenCalled();
    expect(data.formats.silver_age.young[0].name).toBe('cachedhero');
  });

  it('writes the computed payload to Redis on a cache miss', async () => {
    const set = vi.fn();
    mockGetRedis.mockReturnValue({ get: vi.fn().mockResolvedValue(null), set } as any);
    mockListHeroCards.mockResolvedValue({ success: true, data: ROWS } as any);

    await heroesByFormatResource.handler();

    expect(set).toHaveBeenCalledOnce();
    const [key, , ex, ttl] = set.mock.calls[0];
    expect(key).toContain('heroes-by-format');
    expect(ex).toBe('EX');
    expect(typeof ttl).toBe('number');
  });
});
