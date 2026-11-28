import { describe, it, expect, vi } from 'vitest';
import { withComboTurnSnapshots, describeComboTurn, type ComboTurnIO } from './combo-turn-snapshot';
import huntsman from './__fixtures__/combo-turn-huntsman.json';

function io(overrides: Partial<ComboTurnIO> = {}): ComboTurnIO {
  return {
    resolveDeck: vi.fn(async (name: string) => (name.toLowerCase() === 'crankiest maxx'
      ? { ok: true as const, publicId: 'DECK1', name: 'Crankiest Maxx' }
      : { ok: false as const, error: `No deck named "${name}"` })),
    fetchGame: vi.fn(async () => huntsman as any),
    fetchCards: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, {
      name: id === 'nitro_mechanoidc' ? 'Nitro Mechanoid' : id, imageUrl: null, pitch: null,
      types: id === 'hit_the_gas_blue' ? ['action'] : id.includes('hero') || id.startsWith('maxx') || id.startsWith('arakni') ? ['hero'] : ['weapon'],
    }]))),
    ...overrides,
  };
}

const input = { type: 'combo-turn', deckName: 'Crankiest Maxx', resultId: 'R1', turn: 8, captions: ['Throttle first.'] };

describe('withComboTurnSnapshots', () => {
  it('freezes the turn and drops the lookup fields', async () => {
    const deps = io();
    const [out] = await withComboTurnSnapshots([input], deps, new Date('2026-11-28T12:00:00Z'));
    expect(deps.fetchGame).toHaveBeenCalledWith('DECK1', 'R1');
    expect(out).toMatchObject({ type: 'combo-turn', captions: ['Throttle first.'] });
    expect(out.snapshot).toMatchObject({ turn: 8, lethal: true, takenAt: '2026-11-28', deckName: 'Crankiest Maxx' });
    expect(out.snapshot.steps).toHaveLength(8);
    for (const k of ['deckName', 'resultId', 'turn']) expect(out).not.toHaveProperty(k);
  });

  it('leaves other sections and an already-frozen combo turn alone', async () => {
    const deps = io();
    const frozen = { type: 'combo-turn', snapshot: { turn: 1, steps: [] }, captions: ['edited'] };
    const text = { type: 'text', content: 'hi' };
    expect(await withComboTurnSnapshots([text, frozen], deps)).toEqual([text, frozen]);
    expect(deps.fetchGame).not.toHaveBeenCalled();
  });

  it('errors clearly on an unknown deck, a missing archive, a bad turn or too many captions', async () => {
    await expect(withComboTurnSnapshots([{ ...input, deckName: 'Nope' }], io())).rejects.toThrow(/No deck named "Nope"/);
    await expect(withComboTurnSnapshots([input], io({ fetchGame: vi.fn(async () => null) }))).rejects.toThrow(/no turn-by-turn archive/i);
    await expect(withComboTurnSnapshots([{ ...input, turn: 42 }], io())).rejects.toThrow(/Turn 42/);
    await expect(withComboTurnSnapshots([{ ...input, captions: Array(9).fill('x') }], io())).rejects.toThrow(/8 steps.*9 captions/);
    await expect(withComboTurnSnapshots([{ type: 'combo-turn', deckName: 'Crankiest Maxx', turn: 8 }], io())).rejects.toThrow(/resultId/);
  });
});

describe('describeComboTurn', () => {
  it('numbers the steps so captions can be written against them', async () => {
    const [out] = await withComboTurnSnapshots([input], io());
    const text = describeComboTurn(out);
    expect(text).toMatch(/turn 8 vs arakni_huntsman/i);
    expect(text).toMatch(/1\. throttle_red .*attack.*no hit.*pitched teklo_trebuchet_2000_blue/i);
    expect(text).toMatch(/8\. Nitro Mechanoid .*game ends/i);
    expect(text).toMatch(/caption: "Throttle first\."/);
  });
});
