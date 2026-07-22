import { describe, it, expect, vi } from 'vitest';
import { formatSearchSections, searchPrintingsTool, projectPrintingForMcp } from './searchPrintings';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn().mockResolvedValue({ success: true, data: { printings: [], total: 0 } }),
    bulkResolveByName: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCardIdsByTranslatedName: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getCardTranslations: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

const printing = (overrides: Partial<any>) => ({
  printing_id: 'pid_' + Math.random().toString(36).slice(2, 10),
  card_unique_id: 'cuid_default',
  collector_number: 'CRU007',
  name: 'Beast Within',
  set: 'cru',
  edition: 'u',
  foiling: 's',
  rarity: 'm',
  pitch: 1,
  color: 'red',
  types: ['brute', 'action', 'attack'],
  tcg_market: 6.11,
  ...overrides,
});

describe('projectPrintingForMcp', () => {
  it('carries tcgplayer_url so Volzar can render affiliate price links', () => {
    const projected = projectPrintingForMcp(printing({ tcgplayer_url: 'https://www.tcgplayer.com/product/98765' }));
    expect(projected.tcgplayer_url).toBe('https://www.tcgplayer.com/product/98765');
  });

  it('omits the key entirely when the printing has no TCGplayer listing (no token waste)', () => {
    const projected = projectPrintingForMcp(printing({ tcgplayer_url: null }));
    expect('tcgplayer_url' in projected).toBe(false);
  });

  it('always carries image_url in the structured projection (Volzar tiles render it; no includeImage needed)', () => {
    // The structured payload is UI-only for the hosted chat — printing_id CDN
    // URLs can't be constructed client-side (images deleted 2026-07), so the
    // stored image_url must always ride along.
    const projected = projectPrintingForMcp(
      printing({ image_url: 'https://imagedelivery.net/x/CRU007/public' }),
      {},
    );
    expect(projected.image_url).toBe('https://imagedelivery.net/x/CRU007/public');
  });

  it('omits image_url when the printing has none stored', () => {
    const projected = projectPrintingForMcp(printing({ image_url: null }), {});
    expect('image_url' in projected).toBe(false);
  });
});

describe('formatSearchSections image lines (model-visible text)', () => {
  it('keeps Image: lines opt-in via includeImage (token cost control)', () => {
    const rows = [printing({ image_url: 'https://imagedelivery.net/x/CRU007/public' })];
    const without = formatSearchSections([{ index: 0, query: 'q', total: 1, printings: rows }], {});
    expect(without[0]).not.toContain('Image:');
    const withOpt = formatSearchSections([{ index: 0, query: 'q', total: 1, printings: rows }], { includeImage: true });
    expect(withOpt[0]).toContain('Image: https://imagedelivery.net/x/CRU007/public');
  });
});

describe('formatSearchSections', () => {
  it('groups printings by distinct card and lists each card when results span multiple cards', () => {
    const beastWithin = Array.from({ length: 32 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}` })
    );
    const massacre = Array.from({ length: 32 }, (_, i) =>
      printing({ name: 'Massacre', card_unique_id: 'cuid_massacre', collector_number: 'CRU008', printing_id: `mc_${i}` })
    );

    const sections = formatSearchSections(
      [{ index: 0, query: '{"classes":["brute"],"power":6}', total: 64, printings: [...beastWithin, ...massacre] }],
      {}
    );

    expect(sections).toHaveLength(1);
    const text = sections[0];

    expect(text).toContain('Beast Within');
    expect(text).toContain('Massacre');
    expect(text).toMatch(/across 2 cards/);
    expect(text).not.toMatch(/\(\+63 more printings\)/);
  });

  it('renders an empty section when no printings match', () => {
    const sections = formatSearchSections(
      [{ index: 0, query: 'nope', total: 0, printings: [] }],
      {}
    );
    expect(sections[0]).toMatch(/no results/);
  });

  it('shows a single card with per-card printing count when all results are the same card', () => {
    const beastWithin = Array.from({ length: 5 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}` })
    );

    const sections = formatSearchSections(
      [{ index: 0, query: 'beast within', total: 5, printings: beastWithin }],
      {}
    );

    const text = sections[0];
    expect(text).toContain('Beast Within');
    expect(text).toMatch(/\+4 more printings of this card/);
    // The hidden printings are enumerated as SET·edition·foiling so the client
    // can see the other versions without a second query.
    expect(text).toMatch(/CRU·u·s/);
    expect(text).not.toMatch(/across \d+ cards/);
  });

  it('collapses near-identical printings into TOKEN ×count', () => {
    // 5 printings, all the same set/edition/foiling (e.g. language variants).
    const variants = Array.from({ length: 5 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}` })
    );

    const text = formatSearchSections(
      [{ index: 0, query: 'beast within', total: 5, printings: variants }],
      {}
    )[0];

    // 1 representative + 4 identical others → one deduped token "×4", not 4 repeats.
    expect(text).toMatch(/CRU·u·s ×4/);
  });

  it('caps distinct tail tokens at 8 and reports the overflow', () => {
    // 13 printings each in a DISTINCT set → 12 distinct "other" tokens.
    const many = Array.from({ length: 13 }, (_, i) =>
      printing({ name: 'Beast Within', card_unique_id: 'cuid_beast', printing_id: `bw_${i}`, set: `s${i}` })
    );

    const text = formatSearchSections(
      [{ index: 0, query: 'beast within', total: 13, printings: many }],
      {}
    )[0];

    expect(text).toMatch(/\+12 more printings of this card/);
    expect(text).toMatch(/\+4 more/); // 12 distinct tokens, 8 shown, 4 overflow
  });

  it('preserves the foiling-fallback warning when set', () => {
    const sections = formatSearchSections(
      [{
        index: 0,
        query: 'foo',
        total: 1,
        printings: [printing({ name: 'Foo', card_unique_id: 'cuid_foo' })],
        foilingFallback: true,
      }],
      {}
    );
    expect(sections[0]).toMatch(/No non-foil printing exists/);
  });

  it('shows a non-enumerated "+N more printings" tail for a grouped representative (printing_count)', () => {
    // Grouped mode: the service returns ONE representative per card, carrying a
    // printing_count. The formatter can't enumerate the hidden sets (it never
    // received them), so it reports the count without a SET·edition·foiling list.
    const rep = printing({ name: 'Maximum Velocity', card_unique_id: 'cuid_mv', printing_count: 4 });

    const text = formatSearchSections(
      [{ index: 0, query: 'maximum velocity', total: 1, printings: [rep] }],
      {}
    )[0];

    expect(text).toContain('Maximum Velocity');
    expect(text).toMatch(/\+3 more printings of this card/);
    // No enumerated tail — we don't have the other printings' set codes here.
    expect(text).not.toMatch(/ARC·|EVO·|AIO·/);
  });

  it('shows no printings tail for a grouped representative with printing_count 1', () => {
    const rep = printing({ name: 'Solo Card', card_unique_id: 'cuid_solo', printing_count: 1 });
    const text = formatSearchSections(
      [{ index: 0, query: 'solo card', total: 1, printings: [rep] }],
      {}
    )[0];
    expect(text).toContain('Solo Card');
    expect(text).not.toMatch(/more printing/);
  });
});

describe('searchPrintingsTool.handler — heroLegal × format guardrail', () => {
  it('rejects an adult hero in silver_age with a clear error and never calls the service', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();
    (printingsService.bulkResolveByName as any).mockClear();

    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano, dracai of aether', format: 'silver_age' } }],
    });

    expect(result.success).toBe(false);
    const msg = (result as any).message ?? (result as any).error ?? '';
    expect(msg).toMatch(/silver_age/i);
    expect(msg).toMatch(/young/i);
    expect(msg).toMatch(/kano/);
    expect(printingsService.searchPrintings).not.toHaveBeenCalled();
    expect(printingsService.bulkResolveByName).not.toHaveBeenCalled();
  });

  it('rejects a young hero in cc with a clear error', async () => {
    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano', format: 'cc' } }],
    });
    expect(result.success).toBe(false);
    const msg = (result as any).message ?? (result as any).error ?? '';
    expect(msg).toMatch(/cc|classic constructed/i);
    expect(msg).toMatch(/adult/i);
  });

  it('passes through a valid hero/format combination to the service', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    const result = await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano', format: 'silver_age' } }],
    });
    expect(result.success).not.toBe(false);
    expect(printingsService.searchPrintings).toHaveBeenCalled();
  });

  it('translates heroLegal into heroClasses + heroTalents + heroEssences for elemental young heroes', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'briar', format: 'silver_age' } }],
    });

    expect(printingsService.searchPrintings).toHaveBeenCalled();
    const callArgs = (printingsService.searchPrintings as any).mock.calls[0][0];
    expect(callArgs.heroClasses).toEqual(['runeblade']);
    expect(callArgs.heroTalents).toEqual(['elemental']);
    expect([...(callArgs.heroEssences ?? [])].sort()).toEqual(['earth', 'lightning']);
  });

  it('normalizes a legacy set code in structured filters (sets:["hp1"] → 1hp)', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await searchPrintingsTool.handler({
      cards: [{ filters: { name: 'Braveforge Bracers', exact: true, sets: ['hp1'] } }],
    });

    expect(printingsService.searchPrintings).toHaveBeenCalled();
    const callArgs = (printingsService.searchPrintings as any).mock.calls[0][0];
    expect(callArgs.sets).toEqual(['1hp']);
  });

  it('omits heroEssences when the hero has no essence (e.g. Kano)', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await searchPrintingsTool.handler({
      cards: [{ filters: { heroLegal: 'kano', format: 'silver_age' } }],
    });

    const callArgs = (printingsService.searchPrintings as any).mock.calls[0][0];
    expect(callArgs.heroClasses).toEqual(['wizard']);
    expect(callArgs.heroEssences ?? []).toEqual([]);
  });
});

describe('searchPrintingsTool.handler — card-level grouping', () => {
  const printing = (overrides: Partial<any>) => ({
    printing_id: 'pid_' + Math.random().toString(36).slice(2, 10),
    card_unique_id: 'cuid_default',
    collector_number: 'ARC008',
    name: 'Maximum Velocity',
    set: 'arc',
    edition: 'n',
    foiling: 's',
    rarity: 's',
    pitch: 1,
    color: 'red',
    types: ['mechanologist', 'action', 'attack'],
    tcg_low: 0.37,
    ...overrides,
  });

  it('defaults to groupByCard:true on the complex service query', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await searchPrintingsTool.handler({
      cards: [{ filters: { classes: ['mechanologist'], format: 'cc' } }],
    });

    const opts = (printingsService.searchPrintings as any).mock.calls[0][1];
    expect(opts.groupByCard).toBe(true);
  });

  it('passes groupByCard:false to the service when the caller opts out', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.searchPrintings as any).mockClear();

    await searchPrintingsTool.handler({
      cards: [{ filters: { classes: ['mechanologist'], format: 'cc' } }],
      options: { groupByCard: false },
    });

    const opts = (printingsService.searchPrintings as any).mock.calls[0][1];
    expect(opts.groupByCard).toBe(false);
  });

  it('collapses the bulk/simple path to one representative per card by default', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.bulkResolveByName as any).mockResolvedValueOnce({
      success: true,
      data: [{
        name: 'Maximum Velocity',
        printings: [
          printing({ card_unique_id: 'cuid_mv', set: 'arc', printing_id: 'a', tcg_low: 0.37 }),
          printing({ card_unique_id: 'cuid_mv', set: 'evo', printing_id: 'b', tcg_low: 0.74 }),
          printing({ card_unique_id: 'cuid_mv', set: 'aio', printing_id: 'c', tcg_low: 0.23 }),
          printing({ card_unique_id: 'cuid_mv', set: 'aio', printing_id: 'd', tcg_low: 0.23 }),
        ],
      }],
    });

    const result: any = await searchPrintingsTool.handler({ cards: [{ query: 'Maximum Velocity' }] });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].printings).toHaveLength(1);
    expect(result.results[0].printings[0].printing_count).toBe(4);
    expect(result.results[0].total).toBe(1);
  });

  it('keeps distinct cards separate when one name spans multiple pitches (does not over-collapse)', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.bulkResolveByName as any).mockResolvedValueOnce({
      success: true,
      data: [{
        name: 'Enlightened Strike',
        printings: [
          printing({ name: 'Enlightened Strike', card_unique_id: 'es_red', pitch: 1, printing_id: 'r1' }),
          printing({ name: 'Enlightened Strike', card_unique_id: 'es_red', pitch: 1, printing_id: 'r2' }),
          printing({ name: 'Enlightened Strike', card_unique_id: 'es_yellow', pitch: 2, printing_id: 'y1' }),
          printing({ name: 'Enlightened Strike', card_unique_id: 'es_blue', pitch: 3, printing_id: 'b1' }),
        ],
      }],
    });

    const result: any = await searchPrintingsTool.handler({ cards: [{ query: 'Enlightened Strike' }] });

    expect(result.results[0].printings).toHaveLength(3);
    expect(result.results[0].total).toBe(3);
  });

  it('returns every printing on the bulk/simple path when the caller opts out of grouping', async () => {
    const { printingsService } = await import('@/lib/services');
    (printingsService.bulkResolveByName as any).mockResolvedValueOnce({
      success: true,
      data: [{
        name: 'Maximum Velocity',
        printings: [
          printing({ card_unique_id: 'cuid_mv', set: 'arc', printing_id: 'a' }),
          printing({ card_unique_id: 'cuid_mv', set: 'evo', printing_id: 'b' }),
          printing({ card_unique_id: 'cuid_mv', set: 'aio', printing_id: 'c' }),
        ],
      }],
    });

    const result: any = await searchPrintingsTool.handler({
      cards: [{ query: 'Maximum Velocity' }],
      options: { groupByCard: false },
    });

    expect(result.results[0].printings).toHaveLength(3);
  });
});

describe('stats line (cost / power / defense / pitch)', () => {
  it('includes the card stats so the model never has to guess cost', () => {
    const sections = formatSearchSections(
      [{ index: 0, query: 'cnc', total: 1, printings: [printing({
        name: 'Command and Conquer', cost: 2, power: 6, defense: 3, pitch: 1,
      })] }],
      {}
    );
    expect(sections[0]).toContain('Stats: cost 2 | power 6 | defense 3 | pitch 1 (red)');
  });

  it('skips missing stats without dangling separators, omitting the line when no stats exist', () => {
    const noCost = formatSearchSections(
      [{ index: 0, query: 'q', total: 1, printings: [printing({ cost: null, power: null, defense: 2, pitch: 3 })] }],
      {}
    );
    expect(noCost[0]).toContain('Stats: defense 2 | pitch 3 (blue)');
    expect(noCost[0]).not.toContain('cost');

    const bare = formatSearchSections(
      [{ index: 0, query: 'q', total: 1, printings: [printing({ cost: null, power: null, defense: null, pitch: null })] }],
      {}
    );
    expect(bare[0]).not.toContain('Stats:');
  });

  it('treats zero as a real stat (0-cost cards say cost 0 explicitly)', () => {
    const sections = formatSearchSections(
      [{ index: 0, query: 'q', total: 1, printings: [printing({ cost: 0, power: 4, defense: 3, pitch: 2 })] }],
      {}
    );
    expect(sections[0]).toContain('Stats: cost 0 | power 4 | defense 3 | pitch 2 (yellow)');
  });
});
