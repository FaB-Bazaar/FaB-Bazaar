// The Talishar deck export: a deck as the card counts + matchup plans a
// Talishar-style game client imports. Shared by Talishar's own route
// (app/api/decks/[deckId]/talishar) and the partner play API
// (app/api/partner/v1/play), so the two can never drift.
//
// Main deck = hero + equipment + maindeck (`total`); the inventory (FaB's
// sideboard) is `sideboardTotal`. The bench is never exported.

import { toTalisharIdentifier } from '@/lib/utils';
import { HERO_INFO, YOUNG_HERO_INFO, getTalisharHeroSlug } from '@/lib/fab-constants';
import type { DeckDTO } from '@/lib/services/contracts/IDeckService';

/** FaB Bazaar deck formats → Talishar format codes. */
const FORMAT_MAP: Record<string, string> = {
  'Classic Constructed': 'cc',
  'Silver Age': 'sage',
  'Blitz': 'blitz',
  'Commoner': 'commoner',
  'Living Legend': 'cc', // Living Legend uses CC rules
  'Limited': 'draft',
  'Ultimate Pit Fight': 'upf',
  'Casual': 'open',
};

/** Pitch (a number, or the legacy { $numberInt: "1" } wrapper on old rows) → Talishar colour. */
const PITCH_COLOR_MAP: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };

export interface TalisharCard {
  identifier: string;
  total: number;
  sideboardTotal?: number;
}

export interface TalisharMatchup {
  id: string;        // Talishar expects "id"
  matchupId: string; // FaB Bazaar frontend expects matchupId
  heroId: string;    // kept for backwards compatibility
  name: string;
  preferredTurnOrder: string | null;
  notes: string | null;
  sideboard: { in: string[]; out: string[] };
}

export interface TalisharDeckExport {
  name: string;
  format?: string;
  cards: TalisharCard[];
  matchups?: TalisharMatchup[];
  art?: Record<string, string>;
}

export interface TalisharExportOptions {
  /** Apply this matchup's sideboard swaps to the card counts. */
  matchupId?: string | null;
  /** Add a collector number → image URL map (graphical clients). */
  includeArt?: boolean;
}

export interface TalisharExportDeps {
  /** Does any printing of this card exist? Used only for the hero fallback. */
  hasHeroPrinting: (cardUniqueId: string) => Promise<boolean>;
}

/**
 * A Talishar card identifier: {card_name}_{pitch_color}, or just {card_name}
 * without a pitch. "throttle" pitch 1 → "throttle_red". Double-faced cards
 * convert each face and join them with "__" ("comet storm // shock" →
 * "comet_storm__shock_red").
 */
export function buildTalisharIdentifier(printing: any, fallbackId: string): string {
  const cardName = printing.printingDetails?.name || '';
  const parts = cardName.split(' // ');
  const baseIdentifier =
    parts.map((p: string) => toTalisharIdentifier(p)).filter(Boolean).join('__') || fallbackId;

  const pitchValue = printing.printingDetails?.pitch;
  let pitch: number | null = null;
  if (typeof pitchValue === 'number') {
    pitch = pitchValue;
  } else if (pitchValue && typeof pitchValue === 'object' && '$numberInt' in pitchValue) {
    pitch = parseInt(pitchValue.$numberInt, 10);
  }

  if (pitch && PITCH_COLOR_MAP[pitch]) return `${baseIdentifier}_${PITCH_COLOR_MAP[pitch]}`;
  return baseIdentifier;
}

/** A matchup's hero id as a display name ("dorinthea_ironsong" → "Dorinthea"). */
export function getHeroDisplayName(heroId: string): string {
  const cleanHeroId = heroId.replace(/_/g, ' ').toLowerCase();
  for (const [fullName, info] of Object.entries(HERO_INFO)) {
    if (info.shortName === heroId || info.shortName === cleanHeroId) {
      const parts = fullName.split(',');
      return parts[0].split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  }
  return heroId
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Move one copy per `out` id to the sideboard and one per `in` id into the deck. */
export function applySideboardSwap(cards: TalisharCard[], sideboard: { in: string[]; out: string[] }): TalisharCard[] {
  const result = cards.map(card => ({ ...card }));
  const cardMap = new Map(result.map(card => [card.identifier, card]));

  sideboard.out.forEach(cardId => {
    const card = cardMap.get(cardId);
    if (card && card.total > 0) {
      card.total--;
      card.sideboardTotal = (card.sideboardTotal || 0) + 1;
    }
  });

  sideboard.in.forEach(cardId => {
    const card = cardMap.get(cardId);
    if (card && (card.sideboardTotal || 0) > 0) {
      card.sideboardTotal = card.sideboardTotal! - 1;
      card.total++;
    }
  });

  return result;
}

export async function buildTalisharDeckExport(
  deck: DeckDTO,
  options: TalisharExportOptions,
  deps: TalisharExportDeps,
): Promise<TalisharDeckExport> {
  const cardCounts = new Map<string, { total: number; sideboardTotal: number }>();
  const add = (cardId: string, quantity: number, zone: 'total' | 'sideboardTotal') => {
    const existing = cardCounts.get(cardId) || { total: 0, sideboardTotal: 0 };
    existing[zone] += quantity;
    cardCounts.set(cardId, existing);
  };

  // Hero cards (main deck) — the exact Talishar slug when there is one.
  deck.hero.forEach(printing => {
    const heroName = (printing.printingDetails?.name || '').toLowerCase();
    add(getTalisharHeroSlug(heroName) || buildTalisharIdentifier(printing, printing.printingId), printing.quantity || 1, 'total');
  });

  // No hero printing in the deck but a hero name: add the hero so Talishar can
  // show it, provided a printing of that hero exists.
  if (deck.hero.length === 0 && deck.heroName) {
    const heroKey = deck.heroName.toLowerCase();
    const heroInfo = HERO_INFO[heroKey as keyof typeof HERO_INFO]
      ?? YOUNG_HERO_INFO[heroKey as keyof typeof YOUNG_HERO_INFO];
    if (heroInfo?.cardUniqueId && await deps.hasHeroPrinting(heroInfo.cardUniqueId)) {
      const identifier = getTalisharHeroSlug(heroKey) || toTalisharIdentifier(heroKey) || heroKey.replace(/\s+/g, '_');
      add(identifier, 1, 'total');
    }
  }

  deck.equipment.forEach(printing => add(buildTalisharIdentifier(printing, printing.printingId), printing.quantity || 1, 'total'));
  deck.maindeck.forEach(printing => add(buildTalisharIdentifier(printing, printing.printingId), printing.quantity || 1, 'total'));
  deck.inventory.forEach(printing => add(buildTalisharIdentifier(printing, printing.printingId), printing.quantity || 1, 'sideboardTotal'));

  let cards: TalisharCard[] = Array.from(cardCounts.entries()).map(([identifier, counts]) => ({
    identifier,
    total: counts.total,
    ...(counts.sideboardTotal > 0 && { sideboardTotal: counts.sideboardTotal }),
  }));

  // Matchups (lenient: a malformed one is skipped, never fails the export).
  const matchups: any[] = deck.metadata?.matchups || [];
  const validMatchups: TalisharMatchup[] = matchups
    .filter((matchup: any) => {
      if (!matchup.heroId || !matchup.sideboard) {
        console.warn(`[Talishar Export] Skipping invalid matchup for deck ${deck.publicId}`);
        return false;
      }
      if (!Array.isArray(matchup.sideboard.in) || !Array.isArray(matchup.sideboard.out)) {
        console.warn('[Talishar Export] Skipping matchup with invalid sideboard arrays');
        return false;
      }
      return true;
    })
    .map((matchup: any) => ({
      id: matchup.heroId,
      matchupId: matchup.heroId,
      heroId: matchup.heroId,
      name: getHeroDisplayName(matchup.heroId),
      preferredTurnOrder: matchup.preferredTurnOrder || null,
      notes: matchup.notes || null,
      sideboard: { in: matchup.sideboard.in || [], out: matchup.sideboard.out || [] },
    }));

  if (options.matchupId && validMatchups.length > 0) {
    const selected = validMatchups.find(m => m.matchupId === options.matchupId || m.heroId === options.matchupId);
    if (selected) {
      cards = applySideboardSwap(cards, selected.sideboard);
    } else {
      console.warn(`[Talishar Export] Matchup not found: ${options.matchupId} for deck ${deck.publicId}`);
    }
  }

  // Optional art map for graphical clients. Talishar's game state names cards
  // by collector number only, so a client that wants the player's actual
  // printings (foils, alt arts) needs collector_number → image_url. Known
  // limit: Talishar picks its own printing per identifier, so a reprint's
  // collector number can miss — clients fall back to Talishar's images.
  let art: Record<string, string> | undefined;
  if (options.includeArt) {
    art = {};
    for (const printing of [...deck.hero, ...deck.equipment, ...deck.maindeck, ...deck.inventory]) {
      const collector = printing.printingDetails?.collector_number;
      const imageUrl = printing.printingDetails?.image_url;
      if (collector && imageUrl) art[collector] = imageUrl;
    }
  }

  return {
    name: deck.name,
    ...(deck.format && { format: FORMAT_MAP[deck.format] || deck.format.toLowerCase() }),
    cards,
    ...(validMatchups.length > 0 && { matchups: validMatchups }),
    ...(art && { art }),
  };
}
