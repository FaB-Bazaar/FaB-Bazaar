// Pure helpers for the in-chat "View matchups" panel on deck data cards.
// Matchups come from GET /api/decks/[deckId]/matchups: heroId is a Talishar
// slug ("briar_warden_of_thorns") or a strategy id ("core", "aggro", …), and
// sideboard in/out are swap ids ("{card_name}_{red|yellow|blue}", suffix
// omitted for non-pitched cards).
import { describe, it, expect } from 'vitest';
import {
  matchupDisplayName,
  parseSwapId,
  aggregateSwaps,
  turnOrderLabel,
  matchupsToContext,
  buildSwapLookup,
} from './deck-matchups';

describe('matchupDisplayName', () => {
  it('maps strategy ids to their curated display names', () => {
    expect(matchupDisplayName('core')).toBe('Core Plan');
    expect(matchupDisplayName('aggro')).toBe('Aggro');
    expect(matchupDisplayName('fatigue')).toBe('Fatigue');
  });

  it('title-cases talishar hero slugs', () => {
    expect(matchupDisplayName('briar_warden_of_thorns')).toBe('Briar Warden Of Thorns');
    expect(matchupDisplayName('kano')).toBe('Kano');
  });
});

describe('parseSwapId', () => {
  it('splits the pitch suffix off a pitched card id', () => {
    expect(parseSwapId('sink_below_red')).toEqual({ name: 'Sink Below', pitch: 1 });
    expect(parseSwapId('timesnap_potion_yellow')).toEqual({ name: 'Timesnap Potion', pitch: 2 });
    expect(parseSwapId('unmovable_blue')).toEqual({ name: 'Unmovable', pitch: 3 });
  });

  it('returns null pitch for non-pitched ids (equipment)', () => {
    expect(parseSwapId('fyendals_spring_tunic')).toEqual({ name: 'Fyendals Spring Tunic', pitch: null });
  });
});

describe('aggregateSwaps', () => {
  it('groups duplicate ids with counts, sorted by pitch then name', () => {
    expect(
      aggregateSwaps(['unmovable_blue', 'sink_below_red', 'unmovable_blue', 'fyendals_spring_tunic']),
    ).toEqual([
      { id: 'sink_below_red', name: 'Sink Below', pitch: 1, count: 1 },
      { id: 'unmovable_blue', name: 'Unmovable', pitch: 3, count: 2 },
      { id: 'fyendals_spring_tunic', name: 'Fyendals Spring Tunic', pitch: null, count: 1 },
    ]);
  });

  it('returns an empty list for no swaps', () => {
    expect(aggregateSwaps([])).toEqual([]);
  });
});

describe('buildSwapLookup', () => {
  const row = (name: string, pitch: number | undefined, image: string, type: string, text?: string) => ({
    name,
    pitch,
    image,
    type,
    text,
    preview: { name },
  });

  it('keys deck-card rows by talishar swap id (name + pitch suffix)', () => {
    const lookup = buildSwapLookup([
      { title: 'Maindeck', count: 3, rows: [row('Sink Below', 1, 'https://img/sb', 'Generic Defense Reaction', 'Put Sink Below into your hand.')] },
      { title: 'Inventory', count: 2, rows: [row('Unmovable', 3, 'https://img/um', 'Guardian Defense Reaction')] },
    ]);
    expect(lookup.get('sink_below_red')).toMatchObject({
      image: 'https://img/sb',
      type: 'Generic Defense Reaction',
      text: 'Put Sink Below into your hand.',
    });
    expect(lookup.get('unmovable_blue')).toMatchObject({ image: 'https://img/um', type: 'Guardian Defense Reaction' });
  });

  it('handles non-pitched cards and punctuation the way talishar ids do', () => {
    const lookup = buildSwapLookup([
      { title: 'Equipment', count: 1, rows: [row("Fyendal's Spring Tunic", undefined, 'https://img/fst', 'Generic Equipment - Chest')] },
    ]);
    expect(lookup.get('fyendals_spring_tunic')).toMatchObject({ image: 'https://img/fst' });
  });

  it('carries the row preview through for the hover rail', () => {
    const lookup = buildSwapLookup([
      { title: 'Maindeck', count: 1, rows: [row('Command and Conquer', 1, 'https://img/cnc', 'Generic Attack')] },
    ]);
    expect(lookup.get('command_and_conquer_red')?.preview).toEqual({ name: 'Command and Conquer' });
  });
});

describe('matchupsToContext', () => {
  it('summarizes each matchup with turn order, swaps and notes on one line', () => {
    const ctx = matchupsToContext('Briar CC', [
      {
        heroId: 'kano',
        preferredTurnOrder: 'Second' as const,
        notes: 'Hold arcane barrier up.',
        sideboard: { in: ['unmovable_blue', 'unmovable_blue'], out: ['sink_below_red'] },
      },
      {
        heroId: 'core',
        preferredTurnOrder: null,
        notes: null,
        sideboard: { in: [], out: [] },
      },
    ]);
    expect(ctx).toContain('Configured matchups for deck "Briar CC" (2)');
    expect(ctx).toContain('vs Kano — Go second; in: 2x Unmovable (blue); out: 1x Sink Below (red); notes: Hold arcane barrier up.');
    expect(ctx).toContain('vs Core Plan — no swaps');
  });
});

describe('turnOrderLabel', () => {
  it('labels each preference, null when unset', () => {
    expect(turnOrderLabel('First')).toBe('Go first');
    expect(turnOrderLabel('Second')).toBe('Go second');
    expect(turnOrderLabel('NoPreference')).toBe('No turn-order preference');
    expect(turnOrderLabel(null)).toBeNull();
  });
});
