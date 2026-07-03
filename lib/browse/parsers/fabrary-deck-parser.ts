// lib/browse/parsers/fabrary-deck-parser.ts
//
// Parses a decklist copy-pasted from FaBrary (https://fabrary.net) into its
// header fields (name / hero / format) plus the individual card lines.
//
// A FaBrary export looks like:
//
//   Name: My Deck
//   Hero: Puffin, Hightail
//   Format: Classic Constructed
//
//   Arena cards
//   1x Achilles Accelerator
//   ...
//   Deck cards
//   2x Backspin Thrust (red)
//   ...
//
//   Made with love at the FaBrary
//   See the full deck @ https://fabrary.net/decks/...
//
// The "Arena cards" / "Deck cards" section labels and the footer lines are not
// cards, so we only feed lines that begin with a quantity ("2x", "10x", "1")
// into the shared card-list parser. Category (arena vs deck) is intentionally
// NOT trusted here — it's re-derived from each printing's card types downstream.

import { parseCardListFormat, type ParsedCard } from './bulk-input-parser';

export interface ParsedFabraryDeck {
  name: string;
  heroName: string;
  format: string;
  cards: ParsedCard[];
}

// A card line always leads with a quantity: "2x Foo", "10x Bar", or "1 Baz".
const CARD_LINE_PATTERN = /^\d+x?\s+/i;

function headerValue(lines: string[], label: string): string {
  const prefix = `${label.toLowerCase()}:`;
  const line = lines.find(l => l.toLowerCase().startsWith(prefix));
  if (!line) return '';
  return line.slice(line.indexOf(':') + 1).trim();
}

export function parseFabraryDeck(input: string): ParsedFabraryDeck {
  const lines = input
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const name = headerValue(lines, 'Name');
  const heroName = headerValue(lines, 'Hero');
  const format = headerValue(lines, 'Format');

  const cardLines = lines.filter(l => CARD_LINE_PATTERN.test(l));
  const cards = parseCardListFormat(cardLines).filter(c => c.name);

  return { name, heroName, format, cards };
}
