import { describe, it, expect } from 'vitest';
import { buildBulkCardInstances, mergeBulkInstances } from './group-bulk-results';
import type { ParsedCard } from './parsers/bulk-input-parser';

const parsed = (over: Partial<ParsedCard>): ParsedCard => ({
  name: '', quantity: 1, color: '', isPartialMatch: false, set: '', foiling: '', edition: '', ...over,
});
const p = (over: Record<string, unknown>) => ({
  printing_id: 'x', card_unique_id: 'rhinar', collector_number: 'WTR001', set: 'wtr',
  edition: 'u', foiling: 's', language: 'en', display_name: 'Rhinar', ...over,
});

describe('buildBulkCardInstances', () => {
  it('keeps two collector-number lines for the SAME card as two rows with their own quantity and printings', () => {
    const cards = [
      parsed({ name: 'wtr001', collectorNumber: 'WTR001', quantity: 2 }),
      parsed({ name: '1hp001', collectorNumber: '1HP001', quantity: 1 }),
    ];
    const results = [
      { index: 0, printings: [p({ printing_id: 'wtr-a', edition: 'a' }), p({ printing_id: 'wtr-u', edition: 'u' })] },
      { index: 1, printings: [p({ printing_id: 'hp-n', collector_number: '1HP001', set: '1hp', edition: 'n' })] },
    ];

    const instances = buildBulkCardInstances(cards, results as any);

    expect(instances).toHaveLength(2);
    expect(instances[0].quantity).toBe(2);
    expect(instances[0].selectedPrinting.printing_id).toBe('wtr-u');
    expect(instances[0].allPrintings.map((x: any) => x.printing_id)).toEqual(['wtr-a', 'wtr-u']);
    expect(instances[1].quantity).toBe(1);
    expect(instances[1].selectedPrinting.printing_id).toBe('hp-n');
    expect(instances[0].mergeKey).not.toBe(instances[1].mergeKey);
  });

  it('still groups name lines by card_unique_id', () => {
    const cards = [parsed({ name: 'snatch', color: 'red', quantity: 3 })];
    const results = [{ index: 0, printings: [p({ printing_id: 's1', card_unique_id: 'snatch' }), p({ printing_id: 's2', card_unique_id: 'snatch', set: 'arc' })] }];

    const instances = buildBulkCardInstances(cards, results as any);

    expect(instances).toHaveLength(1);
    expect(instances[0].card_unique_id).toBe('snatch');
    expect(instances[0].quantity).toBe(3);
    expect(instances[0].allPrintings).toHaveLength(2);
  });

  it('drops lines that resolved to nothing', () => {
    const cards = [parsed({ name: 'zzz999', collectorNumber: 'ZZZ999' })];
    expect(buildBulkCardInstances(cards, [{ index: 0, printings: [] }])).toEqual([]);
  });
});

describe('mergeBulkInstances', () => {
  it('does not merge a new collector-number row into an existing unstaged row of the same card from a different set', () => {
    const existing = [{ instanceId: 'e1', mergeKey: 'rhinar|WTR001', card_unique_id: 'rhinar', quantity: 2, isStaged: false, forTrade: false, selectedPrinting: p({ printing_id: 'wtr-u' }), allPrintings: [] }];
    const incoming = [{ instanceId: 'n1', mergeKey: 'rhinar|1HP001', card_unique_id: 'rhinar', quantity: 1, isStaged: false, forTrade: false, selectedPrinting: p({ printing_id: 'hp-n' }), allPrintings: [] }];

    const { results, addedCount, updatedCount } = mergeBulkInstances(existing, incoming);

    expect(results).toHaveLength(2);
    expect(addedCount).toBe(1);
    expect(updatedCount).toBe(0);
  });

  it('adds quantity into an existing unstaged row with the same mergeKey', () => {
    const existing = [{ instanceId: 'e1', mergeKey: 'snatch|', card_unique_id: 'snatch', quantity: 2, isStaged: false, forTrade: false, selectedPrinting: p({ printing_id: 's1' }), allPrintings: [] }];
    const incoming = [{ instanceId: 'n1', mergeKey: 'snatch|', card_unique_id: 'snatch', quantity: 1, isStaged: false, forTrade: false, selectedPrinting: p({ printing_id: 's2' }), allPrintings: [] }];

    const { results, addedCount, updatedCount } = mergeBulkInstances(existing, incoming);

    expect(results).toHaveLength(1);
    expect(results[0].quantity).toBe(3);
    expect(results[0].selectedPrinting.printing_id).toBe('s2');
    expect(addedCount).toBe(0);
    expect(updatedCount).toBe(1);
  });

  it('keeps staged rows untouched and sorts them first', () => {
    const existing = [{ instanceId: 'e1', mergeKey: 'snatch|', card_unique_id: 'snatch', quantity: 2, isStaged: true, forTrade: false, selectedPrinting: p({ display_name: 'Snatch' }), allPrintings: [] }];
    const incoming = [{ instanceId: 'n1', mergeKey: 'aaa|', card_unique_id: 'aaa', quantity: 1, isStaged: false, forTrade: false, selectedPrinting: p({ display_name: 'Aaa' }), allPrintings: [] }];

    const { results } = mergeBulkInstances(existing, incoming);

    expect(results.map(r => r.instanceId)).toEqual(['e1', 'n1']);
    expect(results[0].quantity).toBe(2);
  });
});
