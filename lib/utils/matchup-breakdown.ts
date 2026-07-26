// lib/utils/matchup-breakdown.ts
//
// Compute pitch / section breakdowns for a deck after applying a matchup's
// sideboard swaps. Used by the matchup summary view to surface the same
// "Main 80 R/Y/B + eq" stats that the editor shows live.

import { toTalisharIdentifier } from "@/lib/utils";
import type { Breakdown } from "@/components/deck/MatchupBreakdownChip";
import { EMPTY_BREAKDOWN } from "@/components/deck/MatchupBreakdownChip";

export type Section = "red" | "yellow" | "blue" | "equipment" | "hero" | "unpitched";

interface AnyPrinting {
  printingId?: string;
  quantity?: number;
  printingDetails?: {
    name?: string;
    pitch?: number | { $numberInt: string };
    types?: string[];
  };
}

function getPitch(p: AnyPrinting): number | null {
  const pv = p.printingDetails?.pitch;
  if (typeof pv === "number") return pv;
  if (pv && typeof pv === "object" && "$numberInt" in pv) return parseInt(pv.$numberInt, 10);
  return null;
}

const PITCH_SUFFIX: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };

function buildSwapId(p: AnyPrinting): string {
  const name = p.printingDetails?.name || "";
  const baseId = toTalisharIdentifier(name) || p.printingId || "";
  const pitch = getPitch(p);
  return pitch && PITCH_SUFFIX[pitch] ? `${baseId}_${PITCH_SUFFIX[pitch]}` : baseId;
}

function getSection(p: AnyPrinting, defaultCat: "hero" | "equipment" | "maindeck" | "inventory"): Section {
  const types = (p.printingDetails?.types || []).map((t) => t.toLowerCase());
  if (defaultCat === "hero") return "hero";
  // Evo cards are equipment-typed but played from the library — keep them in pitch buckets.
  const isEvo = types.some((t) => t === "evo");
  if (
    types.some((t) => t === "weapon") ||
    (!isEvo && (types.some((t) => t === "equipment") || defaultCat === "equipment"))
  ) {
    return "equipment";
  }
  const pitch = getPitch(p);
  if (pitch === 1) return "red";
  if (pitch === 2) return "yellow";
  if (pitch === 3) return "blue";
  return "unpitched";
}

/**
 * Add `n` cards of `section` to a breakdown.
 *
 * `total` is the LIBRARY — the pips the chip prints (red + yellow + blue +
 * other) and nothing else, so the number always equals the sum of its parts.
 * It is also what the 60+ / Silver Age 40 deck-size limit governs; see
 * DeckEditorSidebar, which caps equipment separately at 5 slots.
 *
 * Equipment & weapons are counted in `equipment` and shown as their own count.
 * The hero is tracked in `hero` alone: it is never a pip and can never be
 * sideboarded (hero tiles are non-interactive).
 */
export function bumpBreakdown(bd: Breakdown, section: Section, n: number) {
  switch (section) {
    case "red":       bd.red += n; break;
    case "yellow":    bd.yellow += n; break;
    case "blue":      bd.blue += n; break;
    case "equipment": bd.equipment += n; return;   // its own count, never in total
    case "hero":      bd.hero += n; return;        // counted, shown nowhere
    default:          bd.other += n;
  }
  bd.library += n;
  bd.total += n;
}

const bump = bumpBreakdown;

// ─── Swap deltas ──────────────────────────────────────────────────────────────

export interface SwapDelta {
  out: number;
  in: number;
  before: number;
  after: number;
}

interface SwapCard {
  section: Section | "weapon";
  originalDeckCount: number;
  deckCount: number;
}

/**
 * Split a sideboard plan's movements by basis, so each "before → after" in the
 * stats bar reconciles with the −out/+in badges beside it. Mixing the two bases
 * into one pair of badges makes the arithmetic fail as soon as a plan benches
 * equipment as well as library cards.
 */
export function computeSwapDeltas(cards: SwapCard[]): { library: SwapDelta; equipment: SwapDelta } {
  const blank = (): SwapDelta => ({ out: 0, in: 0, before: 0, after: 0 });
  const library = blank();
  const equipment = blank();

  for (const c of cards) {
    if (c.section === "hero") continue;
    const target = c.section === "equipment" || c.section === "weapon" ? equipment : library;
    target.before += c.originalDeckCount;
    target.after += c.deckCount;
    target.out += Math.max(0, c.originalDeckCount - c.deckCount);
    target.in += Math.max(0, c.deckCount - c.originalDeckCount);
  }

  return { library, equipment };
}

interface DeckLike {
  hero?: AnyPrinting[];
  equipment?: AnyPrinting[];
  maindeck?: AnyPrinting[];
  inventory?: AnyPrinting[];
}

/**
 * Compute Main / Inventory pitch breakdowns for a deck, optionally with a
 * matchup's `sideboard.in / sideboard.out` swaps applied. Out moves cards from
 * main → inv; in moves cards from inv → main.
 *
 * Note: section attribution for swap IDs uses the union of deck + inventory
 * printings as the lookup table. IDs not found there fall back to "unpitched".
 */
export function computeMatchupBreakdown(
  deck: DeckLike,
  swaps?: { in?: string[]; out?: string[] }
): { main: Breakdown; inv: Breakdown } {
  const main: Breakdown = { ...EMPTY_BREAKDOWN };
  const inv:  Breakdown = { ...EMPTY_BREAKDOWN };

  const sectionById = new Map<string, Section>();

  const tally = (printings: AnyPrinting[] | undefined, defaultCat: "hero" | "equipment" | "maindeck" | "inventory", target: Breakdown) => {
    for (const p of printings ?? []) {
      const qty = p.quantity ?? 1;
      const section = getSection(p, defaultCat);
      const id = buildSwapId(p);
      if (!sectionById.has(id)) sectionById.set(id, section);
      bump(target, section, qty);
    }
  };

  tally(deck.hero,      "hero",      main);
  tally(deck.equipment, "equipment", main);
  tally(deck.maindeck,  "maindeck",  main);
  tally(deck.inventory, "inventory", inv);

  for (const id of swaps?.out ?? []) {
    const sec = sectionById.get(id) ?? "unpitched";
    bump(main, sec, -1);
    bump(inv,  sec,  1);
  }
  for (const id of swaps?.in ?? []) {
    const sec = sectionById.get(id) ?? "unpitched";
    bump(main, sec,  1);
    bump(inv,  sec, -1);
  }

  return { main, inv };
}
