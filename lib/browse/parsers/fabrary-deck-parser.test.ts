// lib/browse/parsers/fabrary-deck-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseFabraryDeck } from './fabrary-deck-parser';

const SAMPLE = `Name: Mexico National Championship 2026 1st 🇲🇽
Hero: Puffin, Hightail
Format: Classic Constructed

Arena cards
1x Achilles Accelerator
1x Adaptive Plating
1x Balance of Justice
1x Cogwerx Tinker Rings
1x Crown of Dominion
1x Polly Cranka
1x Spitfire
1x Teklo Foundry Heart
1x Unicycle
1x Viziertronic Model i

Deck cards
2x Backspin Thrust (red)
2x Backup Protocol: RED (red)
3x Boom Grenade (red)
3x Cog in the Machine (red)
3x Cogwerx Dovetail (red)
3x Cogwerx Zeppelin (red)
3x Fast and Furious (red)
3x Palantir Aeronought (red)
2x Sky Skimmer (red)
3x Soup Up (red)
3x Throttle (red)
3x Zero to Sixty (red)
3x Zipper Hit (red)
2x Cogwerx Zeppelin (yellow)
3x Crash Site Salvage (yellow)
3x Golden Skywarden (yellow)
2x Jolly Bludger (yellow)
1x Skywarden no.161803 (yellow)
3x Zipper Hit (yellow)
3x Cogwerx Workshop (blue)
10x Copper Cog (blue)
3x Sky Skimmer (blue)
2x Soup Up (blue)
2x Throttle (blue)

Made with love at the FaBrary
See the full deck @ https://fabrary.net/decks/01KW7YDAFZGGAFKC0QQT0HS55H`;

describe('parseFabraryDeck', () => {
  it('extracts the deck name from the Name: header (emoji preserved)', () => {
    const result = parseFabraryDeck(SAMPLE);
    expect(result.name).toBe('Mexico National Championship 2026 1st 🇲🇽');
  });

  it('extracts the hero name from the Hero: header', () => {
    const result = parseFabraryDeck(SAMPLE);
    expect(result.heroName).toBe('Puffin, Hightail');
  });

  it('extracts the format from the Format: header', () => {
    const result = parseFabraryDeck(SAMPLE);
    expect(result.format).toBe('Classic Constructed');
  });

  it('does not treat "Arena cards" / "Deck cards" section labels as cards', () => {
    const result = parseFabraryDeck(SAMPLE);
    const names = result.cards.map(c => c.name);
    expect(names).not.toContain('arena cards');
    expect(names).not.toContain('deck cards');
  });

  it('ignores the "Made with love" and "See the full deck @" footer lines', () => {
    const result = parseFabraryDeck(SAMPLE);
    const names = result.cards.map(c => c.name);
    expect(names.some(n => n.includes('made with love'))).toBe(false);
    expect(names.some(n => n.includes('fabrary.net'))).toBe(false);
  });

  it('parses every real card line (10 arena + 24 deck = 34 entries)', () => {
    const result = parseFabraryDeck(SAMPLE);
    expect(result.cards).toHaveLength(34);
  });

  it('parses quantity and name for an arena (pitchless) card', () => {
    const result = parseFabraryDeck(SAMPLE);
    const achilles = result.cards.find(c => c.name === 'achilles accelerator');
    expect(achilles).toBeDefined();
    expect(achilles!.quantity).toBe(1);
    expect(achilles!.color).toBe('');
  });

  it('parses the (color) tag into a pitch color for deck cards', () => {
    const result = parseFabraryDeck(SAMPLE);
    const boom = result.cards.find(c => c.name === 'boom grenade');
    expect(boom).toBeDefined();
    expect(boom!.quantity).toBe(3);
    expect(boom!.color).toBe('red');
  });

  it('keeps same-named cards of different colors as separate entries', () => {
    const result = parseFabraryDeck(SAMPLE);
    const zeppelins = result.cards.filter(c => c.name === 'cogwerx zeppelin');
    expect(zeppelins).toHaveLength(2);
    expect(zeppelins.map(z => z.color).sort()).toEqual(['red', 'yellow']);
  });

  it('handles a card name containing a period (no.161803)', () => {
    const result = parseFabraryDeck(SAMPLE);
    const skywarden = result.cards.find(c => c.name === 'skywarden no.161803');
    expect(skywarden).toBeDefined();
    expect(skywarden!.color).toBe('yellow');
  });

  it('handles a large quantity like 10x Copper Cog', () => {
    const result = parseFabraryDeck(SAMPLE);
    const copper = result.cards.find(c => c.name === 'copper cog');
    expect(copper!.quantity).toBe(10);
    expect(copper!.color).toBe('blue');
  });
});
