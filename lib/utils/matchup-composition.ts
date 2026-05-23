// lib/utils/matchup-composition.ts
//
// Compute the post-swap card composition for a deck under a given matchup.
// Returns per-card final quantities for both Main+Equipment and Inventory zones,
// tagged with a Section (hero/equipment/red/yellow/blue/unpitched) for grouping.
//
// Used by MatchupCompositionView to render the "Net composition" tab — the
// physical card lists a user should have after applying the matchup's swap.

import { toTalisharIdentifier } from "@/lib/utils";

export type Section = "hero" | "equipment" | "red" | "yellow" | "blue" | "unpitched";

interface AnyPrinting {
  printingId?: string;
  quantity?: number;
  printingDetails?: {
    name?: string;
    display_name?: string;
    pitch?: number | { $numberInt: string };
    types?: string[];
    image_url?: string;
  };
}

export interface CompositionEntry {
  printing: AnyPrinting;
  qty: number;
  section: Section;
  swapId: string;
}

const PITCH_SUFFIX: Record<number, string> = { 1: "red", 2: "yellow", 3: "blue" };

function getPitch(p: AnyPrinting): number | null {
  const pv = p.printingDetails?.pitch;
  if (typeof pv === "number") return pv;
  if (pv && typeof pv === "object" && "$numberInt" in pv) return parseInt(pv.$numberInt, 10);
  return null;
}

function buildSwapId(p: AnyPrinting): string {
  const name = p.printingDetails?.name || "";
  const baseId = toTalisharIdentifier(name) || p.printingId || "";
  const pitch = getPitch(p);
  return pitch && PITCH_SUFFIX[pitch] ? `${baseId}_${PITCH_SUFFIX[pitch]}` : baseId;
}

function getSection(
  p: AnyPrinting,
  defaultCat: "hero" | "equipment" | "maindeck" | "inventory"
): Section {
  const types = (p.printingDetails?.types || []).map((t) => t.toLowerCase());
  if (defaultCat === "hero") return "hero";
  // Evo cards are equipment-typed but pitched and played from the library.
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

interface DeckLike {
  hero?: AnyPrinting[];
  equipment?: AnyPrinting[];
  maindeck?: AnyPrinting[];
  inventory?: AnyPrinting[];
}

export function computeMatchupComposition(
  deck: DeckLike,
  swaps?: { in?: string[]; out?: string[] }
): { main: CompositionEntry[]; inventory: CompositionEntry[] } {
  const mainMap = new Map<string, CompositionEntry>();
  const invMap = new Map<string, CompositionEntry>();

  const seed = (
    map: Map<string, CompositionEntry>,
    printings: AnyPrinting[] | undefined,
    defaultCat: "hero" | "equipment" | "maindeck" | "inventory"
  ) => {
    for (const p of printings ?? []) {
      const swapId = buildSwapId(p);
      const qty = p.quantity ?? 1;
      const section = getSection(p, defaultCat);
      const existing = map.get(swapId);
      if (existing) {
        existing.qty += qty;
      } else {
        map.set(swapId, { printing: p, qty, section, swapId });
      }
    }
  };

  seed(mainMap, deck.hero, "hero");
  seed(mainMap, deck.equipment, "equipment");
  seed(mainMap, deck.maindeck, "maindeck");
  seed(invMap, deck.inventory, "inventory");

  // Move one copy of `id` from `from` → `to`. If the destination has no entry
  // yet, copy the printing reference and section from the source so the UI can
  // still render image / name / pitch for the newly-arrived card.
  const moveOne = (
    from: Map<string, CompositionEntry>,
    to: Map<string, CompositionEntry>,
    id: string
  ) => {
    const src = from.get(id);
    if (!src || src.qty <= 0) return;
    src.qty -= 1;
    const dst = to.get(id);
    if (dst) {
      dst.qty += 1;
    } else {
      to.set(id, { printing: src.printing, qty: 1, section: src.section, swapId: id });
    }
  };

  for (const id of swaps?.out ?? []) moveOne(mainMap, invMap, id);
  for (const id of swaps?.in ?? []) moveOne(invMap, mainMap, id);

  return {
    main: [...mainMap.values()].filter((e) => e.qty > 0),
    inventory: [...invMap.values()].filter((e) => e.qty > 0),
  };
}
