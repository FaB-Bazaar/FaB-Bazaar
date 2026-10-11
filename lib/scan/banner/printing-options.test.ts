import { describe, it, expect } from 'vitest';
import { orderPrintings, printingLine, defaultScanPrinting } from './printing-options';

const p = (o: Record<string, unknown>) => ({ printing_id: Math.random().toString(36), set: 'wtr', collector_number: 'WTR001', foiling: 's', edition: 'u', language: 'en', tcg_low: '1.00', pitch: 1, ...o });

describe('printingLine', () => {
  it('describes a printing in words: collector number, set, foiling, edition, language, price', () => {
    const line = printingLine(p({ collector_number: 'CRU008', set: 'cru', foiling: 'r', edition: 'f', language: 'ja', tcg_low: '3.5' }));
    expect(line.code).toBe('CRU008');
    expect(line.details).toEqual(['Crucible of War', 'Rainbow Foil', 'First Edition']);
    expect(line.language).toBe('JA');       // its own field: shown as a tag that never gets truncated
    expect(line.price).toBe('$3.50');
  });
  it('shows a dash when there is no TCGplayer low price', () => {
    expect(printingLine(p({ tcg_low: null })).price).toBe('—');
  });
});

describe('orderPrintings', () => {
  it('puts English first, then the cheapest; other languages after', () => {
    const ja = p({ language: 'ja', tcg_low: '0.10' }), enDear = p({ tcg_low: '9.00' }), enCheap = p({ tcg_low: '0.25' }), fr = p({ language: 'fr', tcg_low: '0.05' });
    expect(orderPrintings([ja, enDear, fr, enCheap])).toEqual([enCheap, enDear, fr, ja]);
  });
  it('lists printings without a price after priced ones of the same language', () => {
    const none = p({ tcg_low: null }), priced = p({ tcg_low: '2.00' });
    expect(orderPrintings([none, priced])).toEqual([priced, none]);
  });
});

describe('defaultScanPrinting', () => {
  it('defaults a scanned card to the cheapest English printing (most binder copies are plain non-foils)', () => {
    const eaCold = p({ foiling: 'c', is_extended_art: true, tcg_low: '5.27' }), plain = p({ tcg_low: '0.05' }), ja = p({ language: 'ja', tcg_low: '0.01' });
    expect(defaultScanPrinting([eaCold, ja, plain])).toBe(plain);
  });
  it('returns null when there are no printings', () => {
    expect(defaultScanPrinting([])).toBeNull();
  });
});
