// Pimp My Deck engine — pure and client-safe (constants only, no services).
//
// Ranks every printing of a card by "bling" and, given what the user already
// owns across their whole collection, picks the unowned printings that would
// be a strict upgrade over their best copy. The score is ordinal — only
// comparisons matter, never the absolute number.

import { EDITION_MAP, FOILING_MAP, RARITY_MAP, ART_VARIATIONS_MAP } from '@/lib/fab-constants';

/** The printing fields the engine reads (subset of PrintingDTO wire shape). */
export interface PimpPrinting {
  printing_id: string;
  card_unique_id: string;
  /** Proper-cased card name — the search wire shape's `name` (PrintingDTO has
   *  no display_name field; its `name` is already display-cased). */
  name: string;
  set: string;
  collector_number?: string | null;
  edition: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  art_variations: string[] | null;
  image_url: string | null;
  tcg_low?: number | null;
  tcgplayer_url?: string | null;
}

export interface PimpUpgradeDTO {
  printingId: string;
  displayName: string;
  set: string;
  collectorNumber: string | null;
  edition: string;
  foiling: string;
  rarity: string;
  imageUrl: string | null;
  tcgLow: number | null;
  tcgplayerUrl: string | null;
  score: number;
  badges: string[];
}

export interface PimpCardDTO {
  cardUniqueId: string;
  name: string;
  /** Copies in the deck (context line, not a multiplier on anything). */
  quantity: number;
  /** The user's blingiest owned printing of this card, null if they own none. */
  bestOwned: PimpUpgradeDTO | null;
  /** Unowned printings strictly blingier than bestOwned, best first. */
  upgrades: PimpUpgradeDTO[];
}

export interface PimpResult {
  cards: PimpCardDTO[];
  /** Deck cards where the user already owns a top-tier printing. */
  fullyPimped: number;
  /** Sum of tcg_low over each card's #1 upgrade (missing prices skipped). */
  topPickTotal: number;
}

const FOIL_SCORE: Record<string, number> = { s: 0, n: 0, r: 10, c: 20, g: 30 };
const EDITION_SCORE: Record<string, number> = { a: 6, f: 4 };
// Marvels are the chase pull; promos are special but less so.
const RARITY_SCORE: Record<string, number> = { v: 25, p: 8 };
const ART_SCORE: Record<string, number> = { ea: 5, aa: 5, fa: 6, ab: 4, at: 4, hs: 2 };

/** Art variation codes, lowercased, with the is_extended_art flag folded in. */
function artCodes(p: Pick<PimpPrinting, 'is_extended_art' | 'art_variations'>): string[] {
  const codes = new Set((p.art_variations ?? []).map((v) => v.toLowerCase()));
  if (p.is_extended_art) codes.add('ea');
  return [...codes];
}

export function pimpScore(p: PimpPrinting): number {
  const foil = FOIL_SCORE[p.foiling?.toLowerCase()] ?? 0;
  const rarity = RARITY_SCORE[p.rarity?.toLowerCase()] ?? 0;
  const edition = EDITION_SCORE[p.edition?.toLowerCase()] ?? 0;
  const art = artCodes(p).reduce((sum, c) => sum + (ART_SCORE[c] ?? 0), 0);
  return foil + rarity + edition + art;
}

/** Human labels for what makes this printing special (empty for plain base). */
export function pimpBadges(p: PimpPrinting): string[] {
  const badges: string[] = [];
  const rarity = p.rarity?.toLowerCase();
  if (rarity === 'v' || rarity === 'p') badges.push(RARITY_MAP[rarity]);
  const foil = p.foiling?.toLowerCase();
  if (foil && !['s', 'n'].includes(foil) && FOILING_MAP[foil as keyof typeof FOILING_MAP]) {
    badges.push(FOILING_MAP[foil as keyof typeof FOILING_MAP]);
  }
  for (const code of artCodes(p)) {
    const label = ART_VARIATIONS_MAP[code as keyof typeof ART_VARIATIONS_MAP];
    if (label) badges.push(label);
  }
  const edition = p.edition?.toLowerCase();
  if (edition === 'a' || edition === 'f') badges.push(EDITION_MAP[edition]);
  return badges;
}

function toDTO(p: PimpPrinting): PimpUpgradeDTO {
  return {
    printingId: p.printing_id,
    displayName: p.name,
    set: p.set,
    collectorNumber: p.collector_number ?? null,
    edition: p.edition,
    foiling: p.foiling,
    rarity: p.rarity,
    imageUrl: p.image_url ?? null,
    tcgLow: p.tcg_low ?? null,
    tcgplayerUrl: p.tcgplayer_url ?? null,
    score: pimpScore(p),
    badges: pimpBadges(p),
  };
}

export function computePimpUpgrades(
  deckCards: Array<{ cardUniqueId: string; name: string; quantity: number }>,
  printings: PimpPrinting[],
  ownedCounts: Record<string, number>,
): PimpResult {
  const byCard = new Map<string, PimpPrinting[]>();
  for (const p of printings) {
    const list = byCard.get(p.card_unique_id) ?? [];
    list.push(p);
    byCard.set(p.card_unique_id, list);
  }

  const cards: PimpCardDTO[] = [];
  let fullyPimped = 0;
  let topPickTotal = 0;
  for (const dc of deckCards) {
    const all = byCard.get(dc.cardUniqueId) ?? [];
    if (all.length === 0) continue;

    const owned = all.filter((p) => (ownedCounts[p.printing_id] ?? 0) > 0);
    const bestOwned = owned.reduce<PimpPrinting | null>(
      (best, p) => (!best || pimpScore(p) > pimpScore(best) ? p : best),
      null,
    );
    // Strictly blingier than the best owned copy; owning nothing sets the bar
    // at "plain base" so any special printing qualifies but reprints don't.
    const baseline = bestOwned ? pimpScore(bestOwned) : 0;
    const upgrades = all
      .filter((p) => (ownedCounts[p.printing_id] ?? 0) === 0 && pimpScore(p) > baseline)
      .sort((a, b) =>
        pimpScore(b) - pimpScore(a)
        || (a.tcg_low ?? Number.POSITIVE_INFINITY) - (b.tcg_low ?? Number.POSITIVE_INFINITY),
      );
    if (upgrades.length === 0) {
      if (bestOwned && pimpScore(bestOwned) > 0) fullyPimped++;
      continue;
    }
    topPickTotal += upgrades[0].tcg_low ?? 0;
    cards.push({
      cardUniqueId: dc.cardUniqueId,
      name: dc.name,
      quantity: dc.quantity,
      bestOwned: bestOwned ? toDTO(bestOwned) : null,
      upgrades: upgrades.map(toDTO),
    });
  }
  return { cards, fullyPimped, topPickTotal };
}
