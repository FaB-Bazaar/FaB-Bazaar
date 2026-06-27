/**
 * Unit tests for analyzeGame — the pure derivation that turns a raw archived
 * Talishar game blob into display-ready insight for the deck Results deep-dive.
 *
 * Asserted values come from a REAL archived game (Teklovossen vs Kassai, a
 * 16-turn loss going second) captured in production and saved as a fixture.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeGame } from './analyzeGame';

const payload = JSON.parse(
  readFileSync(join(process.cwd(), 'lib/talishar/__fixtures__/teklo-vs-kassai.payload.json'), 'utf8')
);

describe('analyzeGame', () => {
  const a = analyzeGame(payload);

  it('reads game meta and player framing', () => {
    expect(a.meta.format).toBe('1');
    expect(a.meta.conceded).toBe(false);
    expect(a.you.hero).toBe('teklovossen_the_mechropotent');
    expect(a.you.result).toBe('loss');
    expect(a.you.firstPlayer).toBe(false);
    expect(a.you.turns).toBe(16);
  });

  it('builds a turn-by-turn life race for both players', () => {
    // 17 entries: turn 0 through 16
    expect(a.lifeRace).toHaveLength(17);
    expect(a.lifeRace[0]).toEqual({ turn: 0, you: 40, opp: 40 });
    const last = a.lifeRace[a.lifeRace.length - 1];
    expect(last).toEqual({ turn: 16, you: 3, opp: 4 });
  });

  it('computes damage efficiency (dealt vs threatened)', () => {
    expect(a.you.efficiency.dealt).toBe(38);
    expect(a.you.efficiency.threatened).toBe(93);
    expect(a.you.efficiency.pct).toBe(41); // round(38/93*100)
  });

  it('surfaces headline aggregates straight from the blob', () => {
    expect(a.you.totals.damageBlocked).toBe(104);
    expect(a.you.totals.avgValuePerTurn).toBeCloseTo(11.94, 2);
    expect(a.you.totals.avgDamageDealtPerTurn).toBeCloseTo(2.38, 2);
  });

  it('builds per-turn tempo rows', () => {
    expect(a.you.perTurn).toHaveLength(17);
    const t10 = a.you.perTurn.find((t) => t.turn === 10)!;
    expect(t10.dealt).toBe(9);
    expect(t10.taken).toBe(4);
    expect(t10.blocked).toBe(8);
  });

  it('extracts equipment block contribution from arenaCardResults', () => {
    const processor = a.you.equipment.find((e) => e.cardId === 'evo_steel_soul_processor_blue_equip');
    expect(processor).toBeDefined();
    expect(processor!.blocked).toBe(5);
    const memory = a.you.equipment.find((e) => e.cardId === 'evo_steel_soul_memory_blue_equip');
    expect(memory!.blocked).toBe(4);
  });

  it('extracts hero/weapon activation engine counts', () => {
    const hero = a.you.engine.find((e) => e.cardId === 'teklovossen_esteemed_magnate');
    expect(hero!.activated).toBe(11);
    const leveler = a.you.engine.find((e) => e.cardId === 'teklo_leveler');
    expect(leveler!.activated).toBe(6);
  });

  it('builds a card-performance list with hit rate', () => {
    const tank = a.you.cards.find((c) => c.cardId === 'terminator_tank_red')!;
    expect(tank.played).toBe(3);
    expect(tank.hits).toBe(2);
    expect(tank.hitPct).toBe(67); // round(2/3*100)
    const warmachine = a.you.cards.find((c) => c.cardId === 'war_machine_red')!;
    expect(warmachine.hitPct).toBe(33);
  });

  it('captures the consenting opponent as a full second analysis', () => {
    expect(a.opponent).not.toBeNull();
    expect(a.opponent!.hero).toBe('kassai_of_the_golden_sand');
    expect(a.opponent!.result).toBe('win');
  });

  it('generates human-readable insights', () => {
    expect(Array.isArray(a.insights)).toBe(true);
    expect(a.insights.length).toBeGreaterThan(0);
    // the efficiency story should be one of them
    expect(a.insights.join(' ')).toMatch(/41%|threatened/i);
  });

  it('preserves EXACT per-turn ordering for replay (no offense/defense regrouping)', () => {
    const t0 = a.replay.find((r) => r.turn === 0)!;
    expect(t0.you.map((e) => `${e.cardId}:${e.action}`)).toEqual([
      'adaptive_alpha_mold:B',
      'adaptive_alpha_mold:B',
      'teklovossen_esteemed_magnate:INSTANT',
      'cognition_nodes_blue:P',
      'evo_steel_soul_tower_blue:INSTANT',
      'command_and_conquer_red:P',
      'evo_beta_base_chest_blue:P',
      'fate_foreseen_red:D',
    ]);
    // opponent's turn-0 line is preserved in its own exact order, including the
    // `A` (arsenal/ally) action the grouped play-by-play used to drop.
    expect(t0.opp.map((e) => `${e.cardId}:${e.action}`)).toEqual([
      'hot_streak:M',
      'high_current_currency_blue:P',
      'run_through_yellow:A',
      'cintari_saber:M',
    ]);
  });

  it('covers every turn 0..16 in the replay', () => {
    expect(a.replay.map((r) => r.turn)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it('returns a null opponent when the opponent did not consent', () => {
    const solo = analyzeGame({ ...payload, opponent: null });
    expect(solo.opponent).toBeNull();
    // life race still works (driven by self.turnResults)
    expect(solo.lifeRace[0]).toEqual({ turn: 0, you: 40, opp: 40 });
  });
});
