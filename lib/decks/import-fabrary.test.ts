// lib/decks/import-fabrary.test.ts
import { describe, it, expect, vi } from 'vitest';
import { importFabraryDeck, type ImportFabraryDeps } from './import-fabrary';

// A minimal Fabrary list: 1 hero, 1 arena/equipment card, 2 deck cards.
const LIST = `Name: Test Deck
Hero: Puffin, Hightail
Format: Classic Constructed

Arena cards
1x Teklo Foundry Heart

Deck cards
3x Boom Grenade (red)
2x Copper Cog (blue)`;

// Printing-row factory
const printing = (over: Record<string, any> = {}) => ({
  printing_id: 'p_' + Math.abs(Math.random()).toString(36).slice(2, 8),
  card_unique_id: 'c_default',
  types: ['action'],
  cc_legal: true,
  silver_age_legal: false,
  blitz_legal: false,
  ...over,
});

// Build a deps object where each service returns canned success data. Tests
// override individual functions to exercise specific branches.
function makeDeps(over: Partial<ImportFabraryDeps> = {}): ImportFabraryDeps {
  return {
    createDeck: vi.fn().mockResolvedValue({
      success: true,
      data: { publicId: 'deck-123', name: 'Test Deck', format: 'Classic Constructed' },
    }),
    addPrintings: vi.fn().mockResolvedValue({
      success: true,
      data: { summary: { total: 3, added: 3, failed: 0, totalCardsAdded: 6 } },
    }),
    searchPrintings: vi.fn().mockResolvedValue({
      success: true,
      data: [printing({ printing_id: 'hero_cc', types: ['hero'], cc_legal: true })],
    }),
    bulkResolveByName: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { name: 'teklo foundry heart', printings: [printing({ printing_id: 'tfh', types: ['equipment'] })] },
        { name: 'boom grenade', pitch: 1, printings: [printing({ printing_id: 'boom', types: ['action'] })] },
        { name: 'copper cog', pitch: 3, printings: [printing({ printing_id: 'cog', types: ['resource'] })] },
      ],
    }),
    listExcludedHeroes: vi.fn().mockResolvedValue({ success: true, data: [] }),
    ...over,
  };
}

describe('importFabraryDeck', () => {
  it('creates the deck with the resolved hero printing and the parsed name/format', async () => {
    const deps = makeDeps();
    const result = await importFabraryDeck({ userId: 'u1', text: LIST }, deps);

    expect(result.success).toBe(true);
    expect(deps.createDeck).toHaveBeenCalledTimes(1);
    const [userId, dto] = (deps.createDeck as any).mock.calls[0];
    expect(userId).toBe('u1');
    expect(dto.name).toBe('Test Deck');
    expect(dto.format).toBe('Classic Constructed');
    expect(dto.heroName).toBe('Puffin, Hightail');
    expect(dto.heroPrintingId).toBe('hero_cc');
  });

  it('surfaces the canonical hero_name the service echoes back in the result', async () => {
    // createDeck (service) canonicalizes hero_name from the resolved printing and
    // echoes it in its DTO; the orchestrator reports that, not the parsed line.
    const deps = makeDeps({
      createDeck: vi.fn().mockResolvedValue({
        success: true,
        data: { publicId: 'deck-123', name: 'Test Deck', format: 'Classic Constructed', heroName: 'Puffin, Hightail' },
      }),
    });
    const list = LIST.replace('Hero: Puffin, Hightail', 'Hero: puffin, HIGHTAIL');
    const result = await importFabraryDeck({ userId: 'u1', text: list }, deps);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hero.name).toBe('Puffin, Hightail');
  });

  it('resolves every card and bulk-adds them under the new deck', async () => {
    const deps = makeDeps();
    await importFabraryDeck({ userId: 'u1', text: LIST }, deps);

    expect(deps.addPrintings).toHaveBeenCalledTimes(1);
    const [publicId, userId, printings] = (deps.addPrintings as any).mock.calls[0];
    expect(publicId).toBe('deck-123');
    expect(userId).toBe('u1');
    expect(printings).toHaveLength(3);
    // Boom Grenade x3, red pitch → printing 'boom'
    const boom = printings.find((p: any) => p.printingId === 'boom');
    expect(boom).toMatchObject({ quantity: 3, category: 'maindeck' });
  });

  it('categorizes a non-Evo equipment card as equipment', async () => {
    const deps = makeDeps();
    await importFabraryDeck({ userId: 'u1', text: LIST }, deps);
    const printings = (deps.addPrintings as any).mock.calls[0][2];
    const tfh = printings.find((p: any) => p.printingId === 'tfh');
    expect(tfh.category).toBe('equipment');
  });

  it('maps pitch colors to bulkResolveByName (red=1, blue=3)', async () => {
    const deps = makeDeps();
    await importFabraryDeck({ userId: 'u1', text: LIST }, deps);
    const resolveArg = (deps.bulkResolveByName as any).mock.calls[0][0];
    expect(resolveArg).toContainEqual({ name: 'boom grenade', pitch: 1 });
    expect(resolveArg).toContainEqual({ name: 'copper cog', pitch: 3 });
    expect(resolveArg).toContainEqual({ name: 'teklo foundry heart', pitch: undefined });
  });

  it('reports cards that could not be resolved and still adds the rest', async () => {
    const deps = makeDeps({
      bulkResolveByName: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'teklo foundry heart', printings: [printing({ printing_id: 'tfh', types: ['equipment'] })] },
          { name: 'boom grenade', pitch: 1, printings: [] }, // not found
          { name: 'copper cog', pitch: 3, printings: [printing({ printing_id: 'cog' })] },
        ],
      }),
    });
    const result = await importFabraryDeck({ userId: 'u1', text: LIST }, deps);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unresolved).toContain('Boom Grenade (red)');
    }
    const printings = (deps.addPrintings as any).mock.calls[0][2];
    expect(printings.map((p: any) => p.printingId).sort()).toEqual(['cog', 'tfh']);
  });

  it('fails without creating a deck when the Hero: line is missing', async () => {
    const deps = makeDeps();
    const noHero = LIST.replace('Hero: Puffin, Hightail\n', '');
    const result = await importFabraryDeck({ userId: 'u1', text: noHero }, deps);

    expect(result.success).toBe(false);
    expect(deps.createDeck).not.toHaveBeenCalled();
  });

  it('picks a format-legal hero printing (skips a non-CC-legal candidate)', async () => {
    const deps = makeDeps({
      searchPrintings: vi.fn().mockResolvedValue({
        success: true,
        data: [
          printing({ printing_id: 'hero_young', types: ['hero'], cc_legal: false, blitz_legal: true }),
          printing({ printing_id: 'hero_cc', types: ['hero'], cc_legal: true }),
        ],
      }),
    });
    await importFabraryDeck({ userId: 'u1', text: LIST }, deps);
    const dto = (deps.createDeck as any).mock.calls[0][1];
    expect(dto.heroPrintingId).toBe('hero_cc');
  });

  it('fails when the hero has no format-legal printing', async () => {
    const deps = makeDeps({
      searchPrintings: vi.fn().mockResolvedValue({
        success: true,
        data: [printing({ printing_id: 'hero_young', types: ['hero'], cc_legal: false })],
      }),
    });
    const result = await importFabraryDeck({ userId: 'u1', text: LIST }, deps);
    expect(result.success).toBe(false);
    expect(deps.createDeck).not.toHaveBeenCalled();
  });
});
