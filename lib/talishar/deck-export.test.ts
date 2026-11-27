import { describe, it, expect, vi } from 'vitest';
import { buildTalisharDeckExport } from './deck-export';

// The Talishar deck export, shared by Talishar's own route
// (/api/decks/[id]/talishar) and the partner play API. These pin the shape
// Talishar's PHP reads today.

const card = (name: string, quantity: number, pitch?: number, extra: Record<string, unknown> = {}) => ({
  printingId: `p-${name}-${pitch ?? 0}`,
  quantity,
  printingDetails: { name, pitch, ...extra },
});

const deck = (over: Record<string, unknown> = {}) => ({
  publicId: 'pub-1',
  name: 'Aether Kano',
  format: 'Classic Constructed',
  heroName: 'kano, dracai of aether',
  hero: [card('kano, dracai of aether', 1)],
  equipment: [card('crown of seeds', 1)],
  maindeck: [card('blazing aether', 3, 1), card('sink below', 2, 1)],
  inventory: [card('sink below', 1, 1), card('comet storm // shock', 2, 1)],
  metadata: {},
  ...over,
}) as any;

const noFallback = { hasHeroPrinting: vi.fn(async () => false) };

describe('buildTalisharDeckExport', () => {
  it('counts hero, equipment and main deck as total and the inventory as sideboardTotal', async () => {
    const out = await buildTalisharDeckExport(deck(), {}, noFallback);
    expect(out.name).toBe('Aether Kano');
    expect(out.format).toBe('cc');
    expect(out.cards).toEqual([
      { identifier: 'kano_dracai_of_aether', total: 1 },
      { identifier: 'crown_of_seeds', total: 1 },
      { identifier: 'blazing_aether_red', total: 3 },
      { identifier: 'sink_below_red', total: 2, sideboardTotal: 1 },
      { identifier: 'comet_storm__shock_red', total: 0, sideboardTotal: 2 },
    ]);
    expect(out).not.toHaveProperty('matchups');
    expect(out).not.toHaveProperty('art');
  });

  it("maps each deck format to Talishar's code", async () => {
    for (const [format, code] of [['Silver Age', 'sage'], ['Blitz', 'blitz'], ['Living Legend', 'cc'], ['Casual', 'open']]) {
      expect((await buildTalisharDeckExport(deck({ format }), {}, noFallback)).format).toBe(code);
    }
  });

  it('includes the well-formed matchups and skips broken ones', async () => {
    const out = await buildTalisharDeckExport(deck({
      metadata: {
        matchups: [
          { heroId: 'briar', preferredTurnOrder: 'First', notes: 'race', sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] } },
          { heroId: 'no_sideboard' },
          { heroId: 'bad_arrays', sideboard: { in: 'x', out: [] } },
        ],
      },
    }), {}, noFallback);
    expect(out.matchups).toEqual([{
      id: 'briar', matchupId: 'briar', heroId: 'briar', name: 'Briar',
      preferredTurnOrder: 'First', notes: 'race',
      sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] },
    }]);
  });

  it("applies a matchup's swaps when asked for that matchup", async () => {
    const out = await buildTalisharDeckExport(deck({
      metadata: { matchups: [{ heroId: 'briar', sideboard: { in: ['sink_below_red'], out: ['blazing_aether_red'] } }] },
    }), { matchupId: 'briar' }, noFallback);
    expect(out.cards).toContainEqual({ identifier: 'blazing_aether_red', total: 2, sideboardTotal: 1 });
    expect(out.cards).toContainEqual({ identifier: 'sink_below_red', total: 3, sideboardTotal: 0 });
  });

  it('adds a collector number → image map only when asked', async () => {
    const withArt = deck({ maindeck: [card('blazing aether', 3, 1, { collector_number: 'DTD001', image_url: 'https://img/1' })] });
    expect((await buildTalisharDeckExport(withArt, { includeArt: true }, noFallback)).art).toEqual({ DTD001: 'https://img/1' });
  });

  it('falls back to the hero name when the deck has no hero card, if a printing of the hero exists', async () => {
    const hasHeroPrinting = vi.fn(async () => true);
    const out = await buildTalisharDeckExport(deck({ hero: [] }), {}, { hasHeroPrinting });
    expect(hasHeroPrinting).toHaveBeenCalledWith(expect.any(String));
    expect(out.cards[0]).toEqual({ identifier: 'kano_dracai_of_aether', total: 1 });

    const none = await buildTalisharDeckExport(deck({ hero: [] }), {}, noFallback);
    expect(none.cards.map(c => c.identifier)).not.toContain('kano_dracai_of_aether');
  });
});
