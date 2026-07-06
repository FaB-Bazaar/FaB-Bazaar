// lib/decks/import-fabrary.ts
//
// Orchestrates "create a deck from a pasted FaBrary list": parse the list,
// resolve the hero to a format-legal printing, create the deck, resolve every
// card line to a printing, and bulk-add them.
//
// Service access is dependency-injected (see ImportFabraryDeps) so the logic is
// unit-testable with plain fakes and so the route can bind the real service
// layer lazily (avoiding the circular-dep trap documented in the root CLAUDE.md).

import { parseFabraryDeck } from '@/lib/browse/parsers/fabrary-deck-parser';
import { sortPrintings } from '@/lib/fab-constants/sets';
import type { ParsedCard } from '@/lib/browse/parsers/bulk-input-parser';

type AsyncResult<T> = { success: true; data: T } | { success: false; error: string };

export interface ImportFabraryDeps {
  createDeck: (userId: string, dto: any) => Promise<AsyncResult<any>>;
  addPrintings: (publicId: string, userId: string, printings: any[]) => Promise<AsyncResult<any>>;
  searchPrintings: (filters: any, options?: any) => Promise<AsyncResult<any>>;
  bulkResolveByName: (
    cards: Array<{ name: string; pitch?: number }>,
  ) => Promise<AsyncResult<Array<{ name: string; pitch?: number; printings: any[] }>>>;
  listExcludedHeroes?: (registryFormat: string) => Promise<AsyncResult<Array<{ cardUniqueId: string }>>>;
}

export interface ImportFabraryResult {
  publicId: string;
  deckName: string;
  format: string;
  hero: { name: string; printingId: string };
  summary: { cardsRequested: number; cardsResolved: number; cardsAdded: number; failed: number };
  unresolved: string[];
}

// Pitch color → numeric pitch used by the printings DB / bulkResolveByName.
function colorToPitch(color: string): number | undefined {
  switch (color) {
    case 'red': return 1;
    case 'yellow': return 2;
    case 'blue': return 3;
    default: return undefined;
  }
}

// Which DB legality column gates a hero printing for the deck's format.
function legalityField(format: string): 'cc_legal' | 'silver_age_legal' | 'blitz_legal' {
  if (format === 'Silver Age') return 'silver_age_legal';
  if (format === 'Blitz') return 'blitz_legal';
  return 'cc_legal';
}

// Format display name → banned_cards registry key (null = no registry entry).
function toRegistryFormat(format: string): string | null {
  switch (format) {
    case 'Classic Constructed': return 'classic_constructed';
    case 'Blitz': return 'blitz';
    case 'Silver Age': return 'silver_age';
    case 'Living Legend': return 'living_legend';
    case 'Commoner': return 'commoner';
    default: return null;
  }
}

// Mirror of the deck bulk-import categorizer: hero → hero, non-Evo
// equipment/weapon → equipment, everything else → maindeck.
function categorize(types: string[]): 'hero' | 'equipment' | 'maindeck' {
  const t = (types || []).map(x => x.toLowerCase());
  if (t.includes('hero')) return 'hero';
  if (t.includes('equipment') || t.includes('weapon')) {
    return t.includes('evo') ? 'maindeck' : 'equipment';
  }
  return 'maindeck';
}

function titleCase(name: string): string {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function cardLabel(card: ParsedCard): string {
  const base = titleCase(card.name);
  return card.color ? `${base} (${card.color})` : base;
}

export async function importFabraryDeck(
  params: { userId: string; text: string },
  deps: ImportFabraryDeps,
): Promise<AsyncResult<ImportFabraryResult>> {
  const { userId, text } = params;

  const parsed = parseFabraryDeck(text);

  if (!parsed.name) return { success: false, error: 'Could not find a deck name in the list.' };
  if (!parsed.heroName) return { success: false, error: 'Could not find a "Hero:" line in the list.' };
  if (!parsed.format) return { success: false, error: 'Could not find a "Format:" line in the list.' };
  if (parsed.cards.length === 0) return { success: false, error: 'No cards found in the list.' };

  // ── Resolve the hero to a format-legal printing ──────────────────────────
  const heroSearch = await deps.searchPrintings({ name: parsed.heroName, exact: true }, { limit: 50 });
  if (!heroSearch.success || !Array.isArray(heroSearch.data) || heroSearch.data.length === 0) {
    return { success: false, error: `Hero "${parsed.heroName}" was not found.` };
  }

  const bannedHeroIds = new Set<string>();
  const registryFormat = toRegistryFormat(parsed.format);
  if (registryFormat && deps.listExcludedHeroes) {
    const banned = await deps.listExcludedHeroes(registryFormat);
    if (banned.success) for (const h of banned.data) bannedHeroIds.add(h.cardUniqueId);
  }

  const field = legalityField(parsed.format);
  const eligibleHeroes = (heroSearch.data as any[]).filter(
    p => p[field] && !(p.card_unique_id && bannedHeroIds.has(p.card_unique_id)),
  );
  if (eligibleHeroes.length === 0) {
    return { success: false, error: `Hero "${parsed.heroName}" has no legal printing in ${parsed.format}.` };
  }
  const heroPrinting = sortPrintings(eligibleHeroes)[0];
  const heroPrintingId = heroPrinting.printing_id;
  // Store the resolved printing's canonical card name (display_name) as the deck's
  // heroName — NOT the raw parsed "Hero:" line. TALISHAR_HERO_IDS is keyed on the
  // canonical name, and both the Talishar export route and the /decks Talishar
  // toggle resolve the hero off heroName. Persisting FaBrary's spelling (casing,
  // punctuation, accents, leetspeak heroes) would leave the hero unresolved on
  // Talishar even though the deck clearly has one. Fall back to the parsed name if
  // a printing somehow lacks a name.
  const heroName: string = heroPrinting.name || parsed.heroName;

  // ── Create the deck (hero added atomically) ──────────────────────────────
  const created = await deps.createDeck(userId, {
    name: parsed.name,
    format: parsed.format,
    heroName,
    heroPrintingId,
    visibility: 'private',
  });
  if (!created.success) return { success: false, error: created.error };
  const publicId: string = created.data.publicId;

  // ── Resolve every card line to a printing ────────────────────────────────
  const resolveInput = parsed.cards.map(c => ({ name: c.name, pitch: colorToPitch(c.color) }));
  const resolved = await deps.bulkResolveByName(resolveInput);
  const byKey = new Map<string, any[]>();
  if (resolved.success) {
    for (const entry of resolved.data) {
      byKey.set(`${entry.name}|${entry.pitch ?? ''}`, entry.printings || []);
    }
  }

  const toAdd: Array<{ printingId: string; quantity: number; category: string }> = [];
  const unresolved: string[] = [];

  for (const card of parsed.cards) {
    const pitch = colorToPitch(card.color);
    const printings = byKey.get(`${card.name}|${pitch ?? ''}`) || [];
    if (printings.length === 0) {
      unresolved.push(cardLabel(card));
      continue;
    }
    const best = sortPrintings(printings)[0];
    const category = categorize(best.types);
    // A deck-card line that resolves to a hero card is a resolution error, not a
    // second hero — the hero was already added at creation. Skip it.
    if (category === 'hero') {
      unresolved.push(cardLabel(card));
      continue;
    }
    toAdd.push({ printingId: best.printing_id, quantity: card.quantity, category });
  }

  let added = 0;
  let failed = 0;
  if (toAdd.length > 0) {
    const addResult = await deps.addPrintings(publicId, userId, toAdd);
    if (addResult.success) {
      added = addResult.data?.summary?.added ?? toAdd.length;
      failed = addResult.data?.summary?.failed ?? 0;
    } else {
      failed = toAdd.length;
    }
  }

  return {
    success: true,
    data: {
      publicId,
      deckName: parsed.name,
      format: parsed.format,
      hero: { name: heroName, printingId: heroPrintingId },
      summary: {
        cardsRequested: parsed.cards.length,
        cardsResolved: toAdd.length,
        cardsAdded: added,
        failed,
      },
      unresolved,
    },
  };
}
