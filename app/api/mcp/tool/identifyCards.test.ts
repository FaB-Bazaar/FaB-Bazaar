import { describe, it, expect, vi } from 'vitest';
import { buildNameIndex } from '@/lib/scan/banner/name-match';
import { identifyCards, summaryText, type IdentifyDeps } from './identifyCards';

// identify_cards: Claude reads the cards in a photo, the scanner's name matcher (lib/scan/banner/name-match) picks the
// card. Pure core with injected lookups, so no DB.
const index = buildNameIndex([
  { name: 'Massacre', pitches: [1] },
  { name: 'Argh... Smash!', pitches: [1, 2, 3] },
  { name: 'Teklo Pounder', pitches: [3], translations: ['Pilonneur Teklo'] },
  { name: 'Sit!', pitches: [1] },
  { name: 'Crown of Providence', pitches: [null] },
]);

let n = 0;
const pr = (name: string, pitch: number | null, o: Record<string, unknown> = {}) => ({
  printing_id: `p${++n}`, card_unique_id: `c-${name}-${pitch}`, name, pitch, set: 'wtr', collector_number: 'WTR001',
  foiling: 's', edition: 'u', language: 'en', tcg_low: 1, tcg_market: 0.01, image_url: `https://img/${n}`, ...o,
});

const PRINTINGS: Record<string, any[]> = {
  'Massacre|1': [pr('Massacre', 1, { collector_number: 'DTD001', tcg_low: 0.5 }), pr('Massacre', 1, { collector_number: 'DTD001', foiling: 'r', tcg_low: 4 })],
  'Argh... Smash!|3': [pr('Argh... Smash!', 3, { collector_number: 'WTR066', tcg_low: 0.1 })],
  'Teklo Pounder|3': [
    pr('Teklo Pounder', 3, { collector_number: 'EVO200', tcg_low: 0.2 }),
    pr('Teklo Pounder', 3, { collector_number: 'EVO200', foiling: 'r', tcg_low: 2 }),
    pr('Teklo Pounder', 3, { collector_number: 'EVO200', language: 'fr', tcg_low: 0.05 }),
  ],
  'Crown of Providence|': [pr('Crown of Providence', null, { collector_number: 'UPR182', foiling: 'r', tcg_low: 95 })],
};
const BY_COLLECTOR: Record<string, any[]> = {
  DTD001: PRINTINGS['Massacre|1'],
  UPR182: PRINTINGS['Crown of Providence|'],
};

function deps(): IdentifyDeps & { byName: ReturnType<typeof vi.fn>; byCollector: ReturnType<typeof vi.fn> } {
  const byName = vi.fn(async (cards: Array<{ name: string; pitch?: number }>) =>
    cards.map(c => ({ ...c, printings: PRINTINGS[`${c.name}|${c.pitch ?? ''}`] ?? [] })));
  const byCollector = vi.fn(async (nums: string[]) => nums.map(cn => ({ collectorNumber: cn, printings: BY_COLLECTOR[cn] ?? [] })));
  return { index, resolveByName: byName, resolveByCollector: byCollector, byName, byCollector };
}

describe('identifyCards', () => {
  it('an exact name in one pitch: confident, pitch settled by the name, cheapest English printing', async () => {
    const { cards } = await identifyCards([{ name: 'Massacre' }], deps());
    expect(cards[0]).toMatchObject({ status: 'confident', matched_name: 'Massacre', pitch: 1 });
    expect(cards[0].printing).toMatchObject({ collector_number: 'DTD001', foiling: 'Non-foil', tcg_low: 0.5 });
  });

  it('a slightly misread name still finds the card', async () => {
    const { cards } = await identifyCards([{ name: 'Teklo Poundr' }], deps());
    expect(cards[0]).toMatchObject({ status: 'confident', matched_name: 'Teklo Pounder', pitch: 3 });
  });

  it('never guesses from junk or a near-miss short name', async () => {
    const { cards } = await identifyCards([{ name: 'zzqx wvvk' }, { name: 'Site' }], deps());
    expect(cards[0].status).toBe('no_match');
    expect(cards[0].printing).toBeNull();
    expect(cards[1].status).not.toBe('confident');
    expect(cards[1].printing).toBeNull();
  });

  it('a name in several pitches and no colour read: asks, with the options', async () => {
    const { cards } = await identifyCards([{ name: 'Argh... Smash!' }], deps());
    expect(cards[0]).toMatchObject({ matched_name: 'Argh... Smash!', pitch: null, pitch_options: ['red', 'yellow', 'blue'] });
    expect(cards[0].printing).toBeNull();
  });

  it('the pitch colour read from the card settles a multi-pitch name', async () => {
    const { cards } = await identifyCards([{ name: 'Argh... Smash!', pitchColor: 'blue' }], deps());
    expect(cards[0]).toMatchObject({ status: 'confident', pitch: 3, pitch_options: [] });
    expect(cards[0].printing).toMatchObject({ collector_number: 'WTR066' });
  });

  it('a collector number that agrees with the name pins that printing', async () => {
    const { cards } = await identifyCards([{ name: 'Crown of Providence', collectorNumber: 'upr182' }], deps());
    expect(cards[0]).toMatchObject({ status: 'confident', matched_name: 'Crown of Providence' });
    expect(cards[0].printing).toMatchObject({ collector_number: 'UPR182', foiling: 'Rainbow Foil' });
  });

  it('a collector number that names a DIFFERENT card: not sure, both candidates, never silently trusted', async () => {
    const { cards } = await identifyCards([{ name: 'Teklo Pounder', collectorNumber: 'DTD001' }], deps());
    expect(cards[0].status).toBe('not_sure');
    expect(cards[0].matched_name).toBe('Teklo Pounder');
    expect(cards[0].runner_up).toBe('Massacre');
    expect(cards[0].notes.join(' ')).toMatch(/DTD001.*Massacre/);
  });

  it('a collector number that does not exist is ignored, with a note', async () => {
    const { cards } = await identifyCards([{ name: 'Massacre', collectorNumber: 'ZZZ999' }], deps());
    expect(cards[0].status).toBe('confident');
    expect(cards[0].notes.join(' ')).toMatch(/ZZZ999/);
  });

  it('the foiling seen picks a printing with that foiling', async () => {
    const { cards } = await identifyCards([{ name: 'Teklo Pounder', foiling: 'rainbow foil' }], deps());
    expect(cards[0].printing).toMatchObject({ foiling: 'Rainbow Foil', tcg_low: 2 });
  });

  it('a foiling the card was never printed in keeps every printing, with a note', async () => {
    const { cards } = await identifyCards([{ name: 'Massacre', foiling: 'gold foil' }], deps());
    expect(cards[0].printing).toMatchObject({ foiling: 'Non-foil' });
    expect(cards[0].notes.join(' ')).toMatch(/gold foil/i);
  });

  it('a translated name finds the English card', async () => {
    const { cards } = await identifyCards([{ name: 'Pilonneur Teklo' }], deps());
    expect(cards[0]).toMatchObject({ status: 'confident', matched_name: 'Teklo Pounder' });
  });

  it('looks up printings for the whole photo in ONE batch call, once per distinct card', async () => {
    const d = deps();
    await identifyCards([{ name: 'Massacre' }, { name: 'Massacre' }, { name: 'Teklo Pounder' }, { name: 'zzqx wvvk' }], d);
    expect(d.byName).toHaveBeenCalledTimes(1);
    expect(d.byName.mock.calls[0][0]).toEqual([{ name: 'Massacre', pitch: 1 }, { name: 'Teklo Pounder', pitch: 3 }]);
    expect(d.byCollector).not.toHaveBeenCalled();
  });

  it('prices with tcg_low only (CLAUDE.md: tcg_low is THE price)', async () => {
    const { cards } = await identifyCards([{ name: 'Massacre' }], deps());
    expect(JSON.stringify(cards)).not.toMatch(/tcg_market/);
  });

  it('offers other printings as alternatives, and echoes quantity and position', async () => {
    const { cards, summary } = await identifyCards([{ name: 'Teklo Pounder', quantity: 2, position: 'row 1, card 2' }, { name: 'zzqx wvvk' }], deps());
    expect(cards[0]).toMatchObject({ quantity: 2, position: 'row 1, card 2' });
    expect(cards[0].alternatives.map(a => a.printing_id)).not.toContain(cards[0].printing!.printing_id);
    expect(cards[0].alternatives).toHaveLength(2);
    expect(summary).toEqual({ confident: 1, not_sure: 0, no_match: 1 });
  });

  it('the text summary marks a card whose pitch is still open with "?", not a tick', async () => {
    const { cards, summary } = await identifyCards([{ name: 'Argh... Smash!' }, { name: 'Massacre' }], deps());
    const lines = summaryText(cards, summary).split('\n');
    expect(lines[1]).toMatch(/^1\. \? Argh\.\.\. Smash!.*which pitch/);
    expect(lines[2]).toMatch(/^2\. ✓ Massacre/);
  });
});
