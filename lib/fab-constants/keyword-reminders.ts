// lib/fab-constants/keyword-reminders.ts
// Official reminder text for game keywords, keyed by the lowercase keyword
// with any magnitude stripped ("ward 10" → "ward"). Wording is taken from the
// reminder text LSS prints on cards (card_translations.text, `**Keyword**
// _(reminder)_`); glyph tokens ({r} {p} {d} {g}) render through parseRulesText.
//
// Used by the card-details lightbox glossary for cards whose rendered text
// names a keyword WITHOUT printing its reminder (e.g. a bare "Go again").

export const KEYWORD_REMINDERS: Record<string, string> = {
  'ambush': 'While this is in your arsenal, you may defend with it.',
  'amp': 'The next time you would deal arcane damage this turn, instead deal that much plus X.',
  'arcane barrier': 'If your hero would be dealt arcane damage, you may pay {r} to prevent 1 of that damage.',
  'arcane shelter': 'If you would be dealt arcane damage, destroy this to prevent 1 of that damage.',
  'battleworn': 'When the combat chain closes, if this defended, put a -1{d} counter on it.',
  'beat chest': 'As an additional cost to play this, you may discard a card with 6 or more {p}.',
  'blade break': 'When the combat chain closes, if this defended, destroy it.',
  'blood debt': 'While this is in your banished zone, at the beginning of your end phase, lose 1{g}.',
  'boost': "As an additional cost to play this, you may banish the top card of your deck. If it's a Mechanologist card, this gets go again.",
  'cloaked': 'Equip this face-down.',
  'combo': 'Combo effects apply if the specified card was the last attack played this combat chain.',
  'crank': 'As this enters the arena, you may remove a steam counter from it. If you do, gain an action point.',
  'dominate': "The defending hero can't defend with or play more than 1 defending card or defense reaction from their hand this chain link.",
  'ephemeral': "This can't start the game in your deck. If this would be put into your graveyard, instead remove it from the game.",
  'go again': 'When this resolves, gain 1 action point.',
  'guardwell': 'When the combat chain closes, if this defended, put -1{d} counters on it equal to its {d}.',
  'heave': 'While this is in your hand, at the beginning of your end phase, you may pay {r}{r} and put this face-up into your arsenal. If you do, create 2 Seismic Surge tokens.',
  'intimidate': 'Target hero banishes face down a random card from their hand. At the beginning of the end phase, return all cards banished this way to their owners hand.',
  'meld': 'You may play 1 or both halves of this card. Each costs 0.',
  'mirage': 'When this is defending a non-Illusionist attack with 6 or more {p}, destroy this.',
  'modular': "This may be equipped to any equipment zone. It has the subtype of the zone it's equipped to.",
  'opt': 'Look at the top card of your deck. You may put it on the bottom.',
  'overpower': "This can't be defended by more than 1 action card.",
  'phantasm': 'When this is defended by a non-Illusionist attack action card with 6 or more {p}, destroy this and close the combat chain.',
  'piercing': 'If this is defended by an equipment, it has +1{p}.',
  'protect': 'You may defend any hero attacked by an opponent with this.',
  'reload': 'If you have no cards in your arsenal, you may put a card from your hand face down into your arsenal.',
  'scrap': 'As an additional cost to play this, you may banish an item or equipment from your graveyard.',
  'spellvoid': 'If you would be dealt arcane damage, you may destroy this to prevent 1 of that damage.',
  'suspense': 'This enters the arena with 2 suspense counters. At the start of your turn, remove a suspense counter from it. When it has none, destroy it.',
  'temper': 'When the combat chain closes, if this defended, put a -1{d} counter on it, then if it has 0{d}, destroy it.',
  'universal': 'While in any zone, this is the same class as your hero.',
  'ward': 'If you would be dealt damage, destroy this to prevent 1 of that damage.',
  'watery grave': 'When this is put into your graveyard from the arena, turn it face-down.',
};

export interface KeywordReminder {
  /** Title-cased base keyword ("Ward", "Go Again") */
  keyword: string;
  /** Lowercase lookup key — use for de-duplication */
  key: string;
  reminder: string;
}

const TRAILING_MAGNITUDE = /\s+(\d+|x)$/i;

/** Resolve a raw keyword mention ("Ward 10", "GO AGAIN") to its reminder, or null. */
export function lookupKeywordReminder(raw: string): KeywordReminder | null {
  const key = raw.trim().toLowerCase().replace(TRAILING_MAGNITUDE, '').replace(/\s+/g, ' ');
  const reminder = KEYWORD_REMINDERS[key];
  if (!reminder) return null;
  const keyword = key.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return { keyword, key, reminder };
}
