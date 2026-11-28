import { describe, it, expect } from 'vitest';
import { buildComboTurn, comboTurnCardIds, comboTurnBlockAttrs, type ComboCardInfo } from './combo-turn';
import huntsman from './__fixtures__/combo-turn-huntsman.json';
import viserai from './__fixtures__/combo-turn-viserai.json';

// Real Crankiest Maxx games (trimmed archived Talishar payloads, own side only).
// huntsman: turn 8 = Hit the Gas into five Nitro Mechanoid attacks, lethal from 24.
// viserai:  turn 4 = assemble the Mechanoid, attack, Hit the Gas, four more attacks.

const card = (name: string, types: string[], pitch: number | null = null): ComboCardInfo =>
  ({ name, types, pitch, imageUrl: `https://img/${name.replace(/\W+/g, '_')}` });

const CARDS: Record<string, ComboCardInfo> = {
  throttle_red: card('Throttle', ['mechanologist', 'action', 'attack'], 1),
  teklo_trebuchet_2000_blue: card('Teklo Trebuchet 2000', ['mechanologist', 'action', 'attack'], 3),
  hyper_scrapper_blue: card('Hyper Scrapper', ['mechanologist', 'action', 'attack'], 3),
  hit_the_gas_blue: card('Hit the Gas', ['mechanologist', 'action'], 3),
  nitro_mechanoidc: card('Nitro Mechanoid', ['mechanologist', 'weapon', 'equipment', 'item']),
  fast_and_furious_red: card('Fast and Furious', ['mechanologist', 'action', 'attack'], 1),
  teklo_foundry_heart: card('Teklo Foundry Heart', ['mechanologist', 'equipment']),
  maxx_the_hype_nitro: card("Maxx 'The Hype' Nitro", ['mechanologist', 'hero']),
  construct_nitro_mechanoid_yellow: card('Construct Nitro Mechanoid', ['mechanologist', 'action'], 2),
  supercell_blue: card('Supercell', ['mechanologist', 'action', 'item'], 3),
  cogwerx_base_legs: card('Cogwerx Base Legs', ['mechanologist', 'equipment']),
  cogwerx_prong_bot_yellow: card('Cogwerx Prong Bot', ['mechanologist', 'action', 'attack'], 2),
  arakni_huntsman: card('Arakni, Huntsman', ['assassin', 'hero']),
  viserai_the_forsaken: card('Viserai, the Forsaken', ['runeblade', 'hero']),
};

const summary = (steps: any[]) => steps.map((s) => [s.name, s.kind, s.outcome ?? null]);

describe('buildComboTurn', () => {
  it('rebuilds the Huntsman lethal turn in play order', () => {
    const t = buildComboTurn(huntsman as any, 8, CARDS);
    expect(summary(t.steps)).toEqual([
      ['Throttle', 'attack', 'no-hit'],
      ['Hyper Scrapper', 'attack', 'hit'],
      ['Hit the Gas', 'action', null],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      // no HIT is logged for the last swing: the game ended on it
      ['Nitro Mechanoid', 'attack', 'lethal'],
    ]);
  });

  it('attaches a pitched card to the card it paid for', () => {
    const t = buildComboTurn(huntsman as any, 8, CARDS);
    expect(t.steps[0].pitched).toEqual([
      { cardId: 'teklo_trebuchet_2000_blue', name: 'Teklo Trebuchet 2000', pitch: 3, imageUrl: CARDS.teklo_trebuchet_2000_blue.imageUrl },
    ]);
    expect(t.steps.slice(1).every((s) => s.pitched.length === 0)).toBe(true);
  });

  it('takes life and damage from the turn totals; a winning last turn ends at 0', () => {
    const t = buildComboTurn(huntsman as any, 8, CARDS);
    expect(t.opponentLife).toEqual({ start: 24, end: 0 });
    expect(t.damage).toEqual({ dealt: 24, threatened: 41 });
    expect(t).toMatchObject({ turn: 8, result: 'win', lethal: true });
    expect(t.opponent).toEqual({ cardId: 'arakni_huntsman', name: 'Arakni, Huntsman', imageUrl: CARDS.arakni_huntsman.imageUrl });
    expect(t.hero.name).toBe("Maxx 'The Hype' Nitro");
  });

  it('labels hero abilities, equipment and instants, and keeps a non-lethal turn alive', () => {
    const t = buildComboTurn(viserai as any, 4, CARDS);
    expect(summary(t.steps)).toEqual([
      ['Fast and Furious', 'attack', 'no-hit'],
      ['Teklo Foundry Heart', 'activate', null],
      ["Maxx 'The Hype' Nitro", 'hero', null],
      ['Construct Nitro Mechanoid', 'action', null],
      ['Cogwerx Base Legs', 'instant', null],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Hit the Gas', 'action', null],
      ['Nitro Mechanoid', 'attack', 'no-hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Nitro Mechanoid', 'attack', 'hit'],
      ['Cogwerx Prong Bot', 'attack', 'hit'],
    ]);
    expect(t.steps[3].pitched.map((p) => p.name)).toEqual(['Supercell']);
    expect(t.steps[11].pitched.map((p) => p.name)).toEqual(['Supercell']);
    expect(t.opponentLife).toEqual({ start: 39, end: 19 });
    expect(t.damage).toEqual({ dealt: 23, threatened: 39 });
    expect(t.lethal).toBe(false);
  });

  it('names the hero the opponent STARTED as, not the end-of-game form', () => {
    // Viserai transformed into Viserai, Usurper; the payload's playerHero is that end state
    expect((viserai as any).opponent.playerHero).toBe('viserai_usurper');
    const t = buildComboTurn(viserai as any, 4, CARDS);
    expect(t.opponent).toMatchObject({ cardId: 'viserai_the_forsaken', name: 'Viserai, the Forsaken' });
    expect(comboTurnCardIds(viserai as any, 4)).toContain('viserai_the_forsaken');
  });

  it('skips blocks made on the opponent\'s turn', () => {
    // huntsman turn 7 opens with two Crankshaft blocks, then a Jump Start attack
    const t = buildComboTurn(huntsman as any, 7, { ...CARDS, jump_start_red: card('Jump Start', ['action', 'attack'], 1), zipper_hit_red: card('Zipper Hit', ['action', 'attack'], 1) });
    expect(summary(t.steps)).toEqual([['Jump Start', 'attack', 'hit']]);
  });

  it('names your turns when the asked-for turn has no plays', () => {
    expect(() => buildComboTurn(huntsman as any, 42, CARDS)).toThrow(/turn 42.*0, 1, 2/i);
  });

  it('falls back to the raw id when a card is unknown', () => {
    const t = buildComboTurn(huntsman as any, 8, {});
    expect(t.steps[0]).toMatchObject({ cardId: 'throttle_red', name: 'throttle red', imageUrl: null, kind: 'play' });
  });
});

describe('comboTurnCardIds', () => {
  it('lists every card the turn needs, heroes included, once each', () => {
    const ids = comboTurnCardIds(huntsman as any, 8);
    expect(ids.sort()).toEqual([
      'arakni_huntsman', 'hit_the_gas_blue', 'hyper_scrapper_blue', 'maxx_the_hype_nitro',
      'nitro_mechanoidc', 'teklo_trebuchet_2000_blue', 'throttle_red',
    ]);
  });
});

describe('comboTurnBlockAttrs', () => {
  it('serialises the frozen turn and captions for <fab-combo-turn>', () => {
    const snapshot = buildComboTurn(huntsman as any, 8, CARDS);
    const attrs = comboTurnBlockAttrs({ type: 'combo-turn', snapshot, captions: ['a', 'b'], heading: 'Five swings' });
    expect(JSON.parse(attrs.snapshot!)).toMatchObject({ turn: 8 });
    expect(attrs.captions).toBe('["a","b"]');
    expect(attrs.heading).toBe('Five swings');
  });

  it('renders nothing useful without a snapshot', () => {
    expect(comboTurnBlockAttrs({ type: 'combo-turn' })).toEqual({ snapshot: undefined, captions: undefined, heading: undefined });
  });
});
