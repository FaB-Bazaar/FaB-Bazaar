/**
 * Tests for renderGameText — turns a raw archived blob into readable, name-
 * resolved turn-by-turn text (what the get_results MCP tool feeds the model).
 * Asserted against the real Teklovossen-vs-Kassai fixture.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderGameText } from './renderGameText';

const payload = JSON.parse(
  readFileSync(join(process.cwd(), 'lib/talishar/__fixtures__/teklo-vs-kassai.payload.json'), 'utf8')
);

describe('renderGameText', () => {
  const text = renderGameText(payload);

  it('leads with a readable header (heroes, result, turns, seat)', () => {
    expect(text).toMatch(/Teklovossen.*vs.*Kassai/i);
    expect(text).toMatch(/LOSS in 16 turns/);
    expect(text).toMatch(/went second/);
  });

  it('includes per-player efficiency summary', () => {
    expect(text).toMatch(/dealt 38\/93/);
    expect(text).toMatch(/blocked 104/);
  });

  it('renders turn 0 in EXACT order with card NAMES (not slugs) and action labels', () => {
    const t0you = text.split('\n').find((l) => /^T0 YOU:/.test(l))!;
    // names resolved from the blob, in stored order, no offense/defense regrouping
    expect(t0you).toContain('blocked Adaptive Alpha Mold');
    expect(t0you).toContain('instant Teklovossen, Esteemed Magnate');
    expect(t0you).toContain('instant Evo Steel Soul Tower');
    expect(t0you).toContain('defended Fate Foreseen');
    // ordering: the tower play comes before the Fate Foreseen defend
    expect(t0you.indexOf('Evo Steel Soul Tower')).toBeLessThan(t0you.indexOf('Fate Foreseen'));
    // no raw slugs leaked
    expect(t0you).not.toContain('evo_steel_soul_tower');
  });

  it('renders the opponent line including the A (arsenal) action the grouped view dropped', () => {
    const t0opp = text.split('\n').find((l) => /^T0 OPP:/.test(l))!;
    expect(t0opp).toContain('Hot Streak');
    expect(t0opp).toContain('Run Through'); // run_through_yellow had action "A"
  });

  it('covers all 17 turns', () => {
    for (let t = 0; t <= 16; t++) {
      expect(text).toMatch(new RegExp(`^T${t} YOU:`, 'm'));
    }
  });

  it('annotates each turn with momentum (life + damage) for trend/pivot analysis', () => {
    // T11 was a damage spike: took 12, dropped to 12 life
    expect(text).toMatch(/T11 {2}\[your life 12 \/ opp 10 · you dealt 8, took 12/);
  });
});
