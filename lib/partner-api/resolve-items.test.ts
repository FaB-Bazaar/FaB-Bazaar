import { describe, it, expect, vi } from 'vitest';
import { parseImportItems, resolveImportItems, type PrintingLookup } from './resolve-items';

const printing = (over: Record<string, unknown>) => ({
  printing_id: 'p-default',
  name: 'command and conquer',
  collector_number: 'ARC159',
  edition: 'n',
  foiling: 's',
  language: 'en',
  art_variations: [],
  is_front_face: true,
  ...over,
});

function lookup(rows: ReturnType<typeof printing>[]): PrintingLookup {
  return {
    byPrintingIds: vi.fn(async (ids: string[]) => rows.filter(r => ids.includes(r.printing_id))),
    byCollectorNumbers: vi.fn(async (nums: string[]) =>
      rows.filter(r => nums.includes(r.collector_number.toUpperCase())),
    ),
  };
}

describe('parseImportItems', () => {
  it('accepts printing ids and collector numbers, defaulting quantity to 1', () => {
    const parsed = parseImportItems([
      { printing_id: 'abc' },
      { collector_number: 'arc159', foiling: 'Rainbow Foil', edition: '1st', quantity: 3, for_trade: true },
    ]);
    expect(parsed).toEqual({
      ok: true,
      items: [
        { printingId: 'abc', quantity: 1, forTrade: false },
        { collectorNumber: 'ARC159', foiling: 'r', edition: 'f', quantity: 3, forTrade: true },
      ],
    });
  });

  it('rejects something that is not a non-empty list', () => {
    expect(parseImportItems(undefined)).toMatchObject({ ok: false });
    expect(parseImportItems([])).toMatchObject({ ok: false });
  });

  it('names the entry that identifies no card', () => {
    const parsed = parseImportItems([{ printing_id: 'abc' }, { quantity: 2 }]);
    expect(parsed).toMatchObject({ ok: false });
    expect((parsed as { message: string }).message).toContain('items[1]');
  });

  it('rejects a quantity that is not a whole number from 1 to 999', () => {
    for (const quantity of [0, -1, 1.5, 1000, '2']) {
      expect(parseImportItems([{ printing_id: 'abc', quantity }])).toMatchObject({ ok: false });
    }
  });

  it('rejects a foiling or edition it does not recognise instead of guessing', () => {
    expect(parseImportItems([{ collector_number: 'ARC159', foiling: 'sparkly' }])).toMatchObject({ ok: false });
    expect(parseImportItems([{ collector_number: 'ARC159', edition: 'zeroth' }])).toMatchObject({ ok: false });
  });

  it('caps the list length', () => {
    const many = Array.from({ length: 2001 }, () => ({ printing_id: 'abc' }));
    expect(parseImportItems(many)).toMatchObject({ ok: false });
  });
});

describe('resolveImportItems', () => {
  it('keeps a printing id that exists and reports one that does not', async () => {
    const result = await resolveImportItems(
      [
        { printingId: 'p-1', quantity: 2, forTrade: true },
        { printingId: 'ghost', quantity: 1, forTrade: false },
      ],
      lookup([printing({ printing_id: 'p-1' })]),
    );
    expect(result.resolved).toEqual([{ index: 0, printingId: 'p-1', quantity: 2, forTrade: true }]);
    expect(result.unresolved).toEqual([{ index: 1, reason: 'not_found' }]);
  });

  it('picks the one printing matching collector number, foiling and edition', async () => {
    const result = await resolveImportItems(
      [{ collectorNumber: 'ARC159', foiling: 'r', edition: 'f', quantity: 1, forTrade: false }],
      lookup([
        printing({ printing_id: 'std' }),
        printing({ printing_id: 'rf-first', foiling: 'r', edition: 'f' }),
        printing({ printing_id: 'rf-unl', foiling: 'r', edition: 'u' }),
      ]),
    );
    expect(result.resolved).toEqual([{ index: 0, printingId: 'rf-first', quantity: 1, forTrade: false }]);
  });

  it('prefers the English printing and the regular art', async () => {
    const result = await resolveImportItems(
      [{ collectorNumber: 'ARC159', foiling: 's', quantity: 1, forTrade: false }],
      lookup([
        printing({ printing_id: 'ja', language: 'ja' }),
        printing({ printing_id: 'alt', art_variations: ['AA'] }),
        printing({ printing_id: 'plain' }),
      ]),
    );
    expect(result.resolved.map(r => r.printingId)).toEqual(['plain']);
  });

  it('reports ambiguous rather than guessing between printings, listing the choices', async () => {
    const result = await resolveImportItems(
      [{ collectorNumber: 'ARC159', quantity: 1, forTrade: false }],
      lookup([printing({ printing_id: 'std' }), printing({ printing_id: 'rf', foiling: 'r' })]),
    );
    expect(result.resolved).toEqual([]);
    expect(result.unresolved).toEqual([
      { index: 0, reason: 'ambiguous', candidates: ['std', 'rf'] },
    ]);
  });

  it('reports a collector number we do not have', async () => {
    const result = await resolveImportItems(
      [{ collectorNumber: 'ZZZ999', quantity: 1, forTrade: false }],
      lookup([printing({})]),
    );
    expect(result.unresolved).toEqual([{ index: 0, reason: 'not_found' }]);
  });

  it('looks up each collector number once', async () => {
    const source = lookup([printing({ printing_id: 'std' })]);
    await resolveImportItems(
      [
        { collectorNumber: 'ARC159', quantity: 1, forTrade: false },
        { collectorNumber: 'ARC159', quantity: 2, forTrade: true },
      ],
      source,
    );
    expect(source.byCollectorNumbers).toHaveBeenCalledTimes(1);
    expect(source.byCollectorNumbers).toHaveBeenCalledWith(['ARC159']);
    expect(source.byPrintingIds).not.toHaveBeenCalled();
  });
});
