// lib/scan/scan-session.test.ts — pure state for the /scan page: a queue of
// photographed cards, each identified → printing chosen → added to a binder.
import { describe, it, expect } from 'vitest';
import {
  scanReducer, initialScanState, defaultPrintingChoice, pendingAdds, fitWithin,
  type ScanCandidate,
} from './scan-session';

const printing = (printingId: string, over: Partial<ScanCandidate['cards'][0]['printings'][0]> = {}) => ({
  printingId, collectorNumber: 'SEA001', set: 'sea', edition: 'N', foiling: 'S', language: 'en',
  rarity: 'C', artVariations: null, imageUrl: null, tcgLow: 1, distance: 3, ...over,
});
const CAND: ScanCandidate = {
  name: 'Sink Below', distance: 3,
  cards: [
    { cardUniqueId: 'c-red', name: 'Sink Below', pitch: 1, distance: 3, printings: [printing('p-red-fr', { language: 'fr', distance: null }), printing('p-red-en')] },
    { cardUniqueId: 'c-blue', name: 'Sink Below', pitch: 3, distance: 3, printings: [printing('p-blue-en')] },
  ],
};

describe('fitWithin', () => {
  it('scales the longer edge down to max, keeping aspect; never upscales', () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitWithin(600, 900, 1000)).toEqual({ width: 600, height: 900 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 });
  });
});

describe('defaultPrintingChoice', () => {
  it('prefers the first card\'s best-matched English printing', () => {
    expect(defaultPrintingChoice(CAND)).toBe('p-red-en');
  });
  it('prefers the non-foil among equally matched English printings (foil siblings share the render)', () => {
    const c: ScanCandidate = { ...CAND, cards: [{ ...CAND.cards[0], printings: [
      printing('p-cf', { foiling: 'C', distance: 3 }),
      printing('p-rf', { foiling: 'R', distance: 3 }),
      printing('p-nf', { foiling: 'S', distance: 3 }),
      printing('p-nf-far', { foiling: 'S', distance: 40 }),
    ] }] };
    expect(defaultPrintingChoice(c)).toBe('p-nf');
  });

  it('falls back to the first printing when nothing is English', () => {
    const c: ScanCandidate = { ...CAND, cards: [{ ...CAND.cards[0], printings: [printing('p-fr', { language: 'fr' })] }] };
    expect(defaultPrintingChoice(c)).toBe('p-fr');
  });
});

describe('scanReducer', () => {
  it('queues a photo, then attaches candidates with a default printing chosen', () => {
    let s = scanReducer(initialScanState, { type: 'queued', id: 'a', previewUrl: 'blob:a' });
    expect(s.items[0]).toMatchObject({ id: 'a', status: 'identifying', quantity: 1 });
    s = scanReducer(s, { type: 'identified', id: 'a', candidates: [CAND], bestDistance: 3, pitchHint: 'red' });
    expect(s.items[0]).toMatchObject({ status: 'ready', chosenPrintingId: 'p-red-en', pitchHint: 'red' });
  });

  it('marks no-match when there are no candidates', () => {
    let s = scanReducer(initialScanState, { type: 'queued', id: 'a', previewUrl: 'blob:a' });
    s = scanReducer(s, { type: 'identified', id: 'a', candidates: [], bestDistance: null, pitchHint: null });
    expect(s.items[0].status).toBe('no-match');
  });

  it('lets the user pick a different printing and quantity', () => {
    let s = scanReducer(initialScanState, { type: 'queued', id: 'a', previewUrl: 'blob:a' });
    s = scanReducer(s, { type: 'identified', id: 'a', candidates: [CAND], bestDistance: 3, pitchHint: null });
    s = scanReducer(s, { type: 'choose', id: 'a', printingId: 'p-blue-en' });
    s = scanReducer(s, { type: 'quantity', id: 'a', quantity: 3 });
    expect(s.items[0]).toMatchObject({ chosenPrintingId: 'p-blue-en', quantity: 3 });
    expect(scanReducer(s, { type: 'quantity', id: 'a', quantity: 0 }).items[0].quantity).toBe(1);
  });

  it('records failures, removals and successful adds', () => {
    let s = scanReducer(initialScanState, { type: 'queued', id: 'a', previewUrl: 'blob:a' });
    s = scanReducer(s, { type: 'queued', id: 'b', previewUrl: 'blob:b' });
    s = scanReducer(s, { type: 'failed', id: 'a', error: 'boom' });
    expect(s.items.find(i => i.id === 'a')).toMatchObject({ status: 'error', error: 'boom' });
    s = scanReducer(s, { type: 'remove', id: 'a' });
    expect(s.items.map(i => i.id)).toEqual(['b']);
    s = scanReducer(s, { type: 'identified', id: 'b', candidates: [CAND], bestDistance: 3, pitchHint: null });
    s = scanReducer(s, { type: 'added', ids: ['b'] });
    expect(s.items[0].status).toBe('added');
  });
});

describe('scanReducer remote items (phone → desktop)', () => {
  it('inserts an already-identified item from a paired phone, ready with a default printing', () => {
    const s = scanReducer(initialScanState, { type: 'remote', id: 'r1', previewUrl: 'data:image/jpeg;base64,xx', candidates: [CAND], bestDistance: 3, pitchHint: 'red' });
    expect(s.items[0]).toMatchObject({ id: 'r1', status: 'ready', chosenPrintingId: 'p-red-en', quantity: 1, previewUrl: 'data:image/jpeg;base64,xx' });
  });
  it('ignores a remote item whose id is already present (SSE replay)', () => {
    let s = scanReducer(initialScanState, { type: 'remote', id: 'r1', previewUrl: '', candidates: [CAND], bestDistance: 3, pitchHint: null });
    s = scanReducer(s, { type: 'remote', id: 'r1', previewUrl: '', candidates: [CAND], bestDistance: 3, pitchHint: null });
    expect(s.items).toHaveLength(1);
  });
  it('a remote item with no candidates is no-match', () => {
    const s = scanReducer(initialScanState, { type: 'remote', id: 'r2', previewUrl: '', candidates: [], bestDistance: null, pitchHint: null });
    expect(s.items[0].status).toBe('no-match');
  });
});

describe('pendingAdds', () => {
  it('collects ready items into binder add rows, merging duplicates of one printing', () => {
    let s = initialScanState;
    for (const id of ['a', 'b', 'c']) {
      s = scanReducer(s, { type: 'queued', id, previewUrl: 'blob:' + id });
      s = scanReducer(s, { type: 'identified', id, candidates: [CAND], bestDistance: 3, pitchHint: null });
    }
    s = scanReducer(s, { type: 'choose', id: 'c', printingId: 'p-blue-en' });
    s = scanReducer(s, { type: 'quantity', id: 'b', quantity: 2 });
    expect(pendingAdds(s)).toEqual([
      { printingId: 'p-red-en', quantity: 3 },
      { printingId: 'p-blue-en', quantity: 1 },
    ]);
  });
});
