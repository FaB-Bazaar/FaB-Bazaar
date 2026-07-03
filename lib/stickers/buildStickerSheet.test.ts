// lib/stickers/buildStickerSheet.test.ts
// Pure-function tests: deck DTO -> ordered, quantity-expanded sticker entries.
import { describe, it, expect } from 'vitest';
import { buildStickerSheet } from './buildStickerSheet';

const printing = (id: string, name: string, num: string, pitch: number | null = null) => ({
  printingId: id,
  quantity: 1,
  printingDetails: {
    display_name: name,
    collector_number: num,
    pitch,
  },
});

const baseDeck = {
  hero: [printing('heroPid_______________', 'Teklovossen, Esteemed Magnate', 'EVO007')],
  equipment: [printing('equipPid______________', 'Teklo Leveler', 'LGS190')],
  maindeck: [
    { ...printing('cncPid________________', 'Command and Conquer', 'ARC159', 1), quantity: 3 },
  ],
  inventory: [printing('sidePid_______________', 'Cognition Nodes', 'ARC018', 3)],
};

describe('buildStickerSheet', () => {
  it('expands quantities into one sticker per physical copy', () => {
    const sections = buildStickerSheet(baseDeck);
    const maindeck = sections.find((s) => s.section === 'Maindeck')!;
    expect(maindeck.stickers).toHaveLength(3);
    expect(new Set(maindeck.stickers.map((s) => s.printingId))).toEqual(
      new Set(['cncPid________________'])
    );
  });

  it('orders sections Hero, Equipment, Maindeck, Sideboard (inventory renamed)', () => {
    const sections = buildStickerSheet(baseDeck);
    expect(sections.map((s) => s.section)).toEqual([
      'Hero',
      'Equipment',
      'Maindeck',
      'Sideboard',
    ]);
  });

  it('builds fabbazaar printing URLs as QR payloads by default', () => {
    const sections = buildStickerSheet(baseDeck);
    const hero = sections[0].stickers[0];
    expect(hero.payload).toBe('https://fabbazaar.app/printing/heroPid_______________');
  });

  it('accepts a base URL override without duplicating slashes', () => {
    const sections = buildStickerSheet(baseDeck, 'http://localhost:3000/');
    expect(sections[0].stickers[0].payload).toBe(
      'http://localhost:3000/printing/heroPid_______________'
    );
  });

  it('carries name, collector number, and pitch onto each sticker', () => {
    const sections = buildStickerSheet(baseDeck);
    const cnc = sections.find((s) => s.section === 'Maindeck')!.stickers[0];
    expect(cnc.name).toBe('Command and Conquer');
    expect(cnc.collectorNumber).toBe('ARC159');
    expect(cnc.pitch).toBe(1);
  });

  it('omits empty sections entirely', () => {
    const sections = buildStickerSheet({ hero: baseDeck.hero });
    expect(sections.map((s) => s.section)).toEqual(['Hero']);
  });

  it('tolerates entries with missing printingDetails', () => {
    const sections = buildStickerSheet({
      maindeck: [{ printingId: 'bare________________x', quantity: 2 }],
    });
    const md = sections[0];
    expect(md.stickers).toHaveLength(2);
    expect(md.stickers[0].name).toBe('Unknown card');
    expect(md.stickers[0].payload).toContain('bare________________x');
  });
});
