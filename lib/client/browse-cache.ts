/**
 * browse-cache.ts
 *
 * Module-level singleton for the full card catalog used by the /search page.
 * Fetches GET /api/printings/browse once per page session (survives re-renders).
 * All search/filter operations run client-side against this in-memory dataset.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrowsePrinting {
  printing_id: string;
  card_unique_id: string;

  // Display
  display_name: string | null;
  type_text_display: string | null;
  color: string | null;
  image_url: string | null;
  printing_card_id: string | null;

  // Game stats (for filtering + sorting)
  types: string[] | null;
  pitch: number | null;
  power: number | null;
  cost: number | null;
  defense: number | null;
  keywords: string[] | null;

  // Class/type flags
  is_generic: boolean;
  is_guardian: boolean;
  is_warrior: boolean;
  is_ninja: boolean;
  is_wizard: boolean;
  is_brute: boolean;
  is_ranger: boolean;
  is_runeblade: boolean;
  is_necromancer: boolean;
  is_mechanologist: boolean;
  is_weapon: boolean;

  // Printing attributes
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  art_variations: string[] | null;
  foil_inset_top: number | null;
  foil_inset_right: number | null;
  foil_inset_bottom: number | null;
  foil_inset_left: number | null;
  foil_inset_round: string | null;

  // Price
  tcg_low: number | null;
  tcg_market: number | null;
  tcgplayer_url: string | null;
}

export interface BrowseFilters {
  name?: string;
  types?: string[];           // type chip (e.g. ['attack'])
  classFlag?: keyof BrowsePrinting; // e.g. 'is_guardian'
  pitch?: number | null;
  keywords?: string[];
  rarities?: string[];
  foilings?: string[];
  editions?: string[];
  sets?: string[];
  costMin?: number;
  costMax?: number;
  powerMin?: number;
  powerMax?: number;
  defenseMin?: number;
  defenseMax?: number;
  priceMax?: number;
}

// ─── Rarity ordering for sort ─────────────────────────────────────────────────

const RARITY_ORDER: Record<string, number> = {
  v: 0, f: 1, l: 2, m: 3, p: 4, s: 5, r: 6, c: 7, t: 8, b: 9,
};

// ─── Module-level singleton ───────────────────────────────────────────────────

let cache: BrowsePrinting[] | null = null;
let inflight: Promise<BrowsePrinting[]> | null = null;

export async function getAllPrintings(): Promise<BrowsePrinting[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = fetch('/api/printings/browse')
    .then(r => {
      if (!r.ok) throw new Error(`Browse fetch failed: ${r.status}`);
      return r.json();
    })
    .then((data: { success: boolean; data: { printings: BrowsePrinting[] } }) => {
      cache = data.data.printings.map(p => ({
        ...p,
        image_url: p.image_url?.replace(/^http:\/\//i, 'https://') ?? null,
        tcgplayer_url: p.tcgplayer_url?.replace(/^http:\/\//i, 'https://') ?? null,
      }));
      inflight = null;
      return cache;
    })
    .catch(err => {
      inflight = null;
      throw err;
    });

  return inflight;
}

/** Fire-and-forget prefetch — call on page mount to warm cache before first click */
export function prefetchAllPrintings(): void {
  getAllPrintings().catch(() => {});
}

// ─── Client-side filter engine ───────────────────────────────────────────────

export function filterPrintings(
  all: BrowsePrinting[],
  filters: BrowseFilters,
): BrowsePrinting[] {
  return all.filter(p => {
    // Name text search
    if (filters.name) {
      const q = filters.name.toLowerCase();
      if (!p.display_name?.toLowerCase().includes(q)) return false;
    }

    // Type filter (e.g. chip value 'attack' → types includes 'attack')
    if (filters.types?.length) {
      const t = (p.types ?? []).map(v => v.toLowerCase());
      const passes = filters.types.some(ft => {
        // Use the dedicated boolean flag for weapon as the reliable source
        if (ft === 'weapon') return p.is_weapon === true || t.includes('weapon');
        return t.includes(ft.toLowerCase());
      });
      if (!passes) return false;
      // Special case: 'non-attack-action' chip excludes attacks
      if (filters.types.includes('action') && t.includes('attack')) return false;
    }

    // Class flag filter (boolean field on the printing)
    if (filters.classFlag) {
      if (!p[filters.classFlag]) return false;
    }

    // Pitch filter
    if (filters.pitch !== undefined) {
      if (p.pitch !== filters.pitch) return false;
    }

    // Keyword filter — card must have ALL selected keywords
    if (filters.keywords?.length) {
      const kws = (p.keywords ?? []).map(k => k.toLowerCase());
      if (!filters.keywords.every(fk => kws.some(k => k.includes(fk.toLowerCase())))) return false;
    }

    // Rarity
    if (filters.rarities?.length) {
      if (!filters.rarities.includes(p.rarity)) return false;
    }

    // Foiling
    if (filters.foilings?.length) {
      if (!filters.foilings.includes(p.foiling)) return false;
    }

    // Edition
    if (filters.editions?.length) {
      if (!filters.editions.includes(p.edition)) return false;
    }

    // Set
    if (filters.sets?.length) {
      if (!filters.sets.includes(p.set)) return false;
    }

    // Stat ranges
    if (filters.costMin    !== undefined && (p.cost    === null || p.cost    < filters.costMin))    return false;
    if (filters.costMax    !== undefined && (p.cost    === null || p.cost    > filters.costMax))    return false;
    if (filters.powerMin   !== undefined && (p.power   === null || p.power   < filters.powerMin))   return false;
    if (filters.powerMax   !== undefined && (p.power   === null || p.power   > filters.powerMax))   return false;
    if (filters.defenseMin !== undefined && (p.defense === null || p.defense < filters.defenseMin)) return false;
    if (filters.defenseMax !== undefined && (p.defense === null || p.defense > filters.defenseMax)) return false;

    // Price cap
    if (filters.priceMax !== undefined && p.tcg_low !== null && p.tcg_low > filters.priceMax) return false;

    return true;
  });
}

// ─── Client-side sort ────────────────────────────────────────────────────────

export function sortPrintings(
  printings: BrowsePrinting[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
): BrowsePrinting[] {
  return [...printings].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':    cmp = (a.display_name ?? '').localeCompare(b.display_name ?? ''); break;
      case 'price':   cmp = (a.tcg_low ?? Infinity) - (b.tcg_low ?? Infinity); break;
      case 'set':     cmp = a.set.localeCompare(b.set); break;
      case 'rarity':  cmp = (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99); break;
      case 'power':   cmp = (a.power ?? -1) - (b.power ?? -1); break;
      case 'cost':    cmp = (a.cost  ?? -1) - (b.cost  ?? -1); break;
      default:        cmp = (a.display_name ?? '').localeCompare(b.display_name ?? '');
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });
}
