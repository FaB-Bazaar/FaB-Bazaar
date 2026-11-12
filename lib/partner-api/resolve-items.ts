// Turning a partner's card list into printing ids. A partner identifies a card
// either by our printing_id or by what is printed on it: collector number plus
// (optionally) foiling and edition. Anything we cannot pin to exactly one
// printing is reported back — never guessed.
import { EDITION_MAP, FOILING_MAP } from '@/lib/fab-constants';

export const MAX_IMPORT_ITEMS = 2000;
const MAX_QUANTITY = 999;

export type ImportItem =
  | { printingId: string; quantity: number; forTrade: boolean }
  | { collectorNumber: string; foiling?: string; edition?: string; quantity: number; forTrade: boolean };

export interface LookupPrinting {
  printing_id: string;
  collector_number: string;
  edition: string;
  foiling: string;
  language?: string;
  art_variations?: string[] | null;
  is_front_face?: boolean | null;
}

export interface PrintingLookup {
  byPrintingIds(ids: string[]): Promise<LookupPrinting[]>;
  byCollectorNumbers(collectorNumbers: string[]): Promise<LookupPrinting[]>;
}

export interface ResolvedItem {
  index: number;
  printingId: string;
  quantity: number;
  forTrade: boolean;
}

export interface UnresolvedItem {
  index: number;
  reason: 'not_found' | 'ambiguous';
  /** printing ids the entry could mean, when it is ambiguous */
  candidates?: string[];
}

// "Rainbow Foil" / "rf" / "r" → "r": every alias in the display map shares a
// display name with exactly one single-letter code, which is what we store.
function codeLookup(map: Record<string, string>): (input: string) => string | undefined {
  const codeByDisplay = new Map<string, string>();
  for (const [alias, display] of Object.entries(map)) {
    if (alias.length === 1 && !codeByDisplay.has(display)) codeByDisplay.set(display, alias);
  }
  return input => {
    const display = map[input.trim().toLowerCase()];
    return display === undefined ? undefined : codeByDisplay.get(display);
  };
}

const foilingCode = codeLookup(FOILING_MAP);
const editionCode = codeLookup(EDITION_MAP);

type Parsed = { ok: true; items: ImportItem[] } | { ok: false; message: string };

export function parseImportItems(input: unknown): Parsed {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, message: '"items" must be a non-empty list.' };
  }
  if (input.length > MAX_IMPORT_ITEMS) {
    return { ok: false, message: `"items" may hold at most ${MAX_IMPORT_ITEMS} entries.` };
  }

  const items: ImportItem[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const at = `items[${i}]`;
    if (!raw || typeof raw !== 'object') return { ok: false, message: `${at} must be an object.` };
    const entry = raw as Record<string, unknown>;

    const quantity = entry.quantity === undefined ? 1 : entry.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { ok: false, message: `${at}.quantity must be a whole number from 1 to ${MAX_QUANTITY}.` };
    }
    const forTrade = entry.for_trade === true;

    if (typeof entry.printing_id === 'string' && entry.printing_id.trim()) {
      items.push({ printingId: entry.printing_id.trim(), quantity, forTrade });
      continue;
    }

    if (typeof entry.collector_number !== 'string' || !entry.collector_number.trim()) {
      return { ok: false, message: `${at} needs a "printing_id" or a "collector_number".` };
    }
    const item: ImportItem = {
      collectorNumber: entry.collector_number.trim().toUpperCase(),
      quantity,
      forTrade,
    };
    if (entry.foiling !== undefined) {
      const code = typeof entry.foiling === 'string' ? foilingCode(entry.foiling) : undefined;
      if (!code) return { ok: false, message: `${at}.foiling is not a foiling we recognise.` };
      item.foiling = code;
    }
    if (entry.edition !== undefined) {
      const code = typeof entry.edition === 'string' ? editionCode(entry.edition) : undefined;
      if (!code) return { ok: false, message: `${at}.edition is not an edition we recognise.` };
      item.edition = code;
    }
    items.push(item);
  }
  return { ok: true, items };
}

function pickPrinting(
  item: Extract<ImportItem, { collectorNumber: string }>,
  all: LookupPrinting[],
): LookupPrinting[] {
  let candidates = all;
  const narrow = (keep: (p: LookupPrinting) => boolean) => {
    const kept = candidates.filter(keep);
    if (kept.length > 0) candidates = kept;
  };

  // Preferences: only applied when they leave something.
  narrow(p => (p.language ?? 'en') === 'en');
  narrow(p => p.is_front_face !== false);

  // Stated attributes: must match.
  if (item.foiling) candidates = candidates.filter(p => p.foiling === item.foiling);
  if (item.edition) candidates = candidates.filter(p => p.edition === item.edition);

  narrow(p => (p.art_variations ?? []).length === 0);
  return candidates;
}

export async function resolveImportItems(
  items: ImportItem[],
  lookup: PrintingLookup,
): Promise<{ resolved: ResolvedItem[]; unresolved: UnresolvedItem[] }> {
  const ids = new Set<string>();
  const collectorNumbers = new Set<string>();
  for (const item of items) {
    if ('printingId' in item) ids.add(item.printingId);
    else collectorNumbers.add(item.collectorNumber);
  }

  const known = new Set(
    ids.size > 0 ? (await lookup.byPrintingIds([...ids])).map(p => p.printing_id) : [],
  );
  const byCollector = new Map<string, LookupPrinting[]>();
  if (collectorNumbers.size > 0) {
    for (const p of await lookup.byCollectorNumbers([...collectorNumbers])) {
      const key = (p.collector_number || '').toUpperCase();
      const list = byCollector.get(key);
      if (list) list.push(p);
      else byCollector.set(key, [p]);
    }
  }

  const resolved: ResolvedItem[] = [];
  const unresolved: UnresolvedItem[] = [];
  items.forEach((item, index) => {
    const { quantity, forTrade } = item;
    if ('printingId' in item) {
      if (known.has(item.printingId)) resolved.push({ index, printingId: item.printingId, quantity, forTrade });
      else unresolved.push({ index, reason: 'not_found' });
      return;
    }
    const candidates = pickPrinting(item, byCollector.get(item.collectorNumber) ?? []);
    if (candidates.length === 1) {
      resolved.push({ index, printingId: candidates[0].printing_id, quantity, forTrade });
    } else if (candidates.length === 0) {
      unresolved.push({ index, reason: 'not_found' });
    } else {
      unresolved.push({ index, reason: 'ambiguous', candidates: candidates.map(p => p.printing_id) });
    }
  });
  return { resolved, unresolved };
}
