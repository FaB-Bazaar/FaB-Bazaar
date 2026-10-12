// app/api/mcp/tool/identifyCards.ts — identify_cards: Claude reads the cards in a user's photo (name, pitch gem, and
// the collector number / foiling when legible); the /scan scanner's name matcher (lib/scan/banner/name-match) picks the
// card, with the same rules against confidently naming the wrong one. Read-only: Claude shows the results, the user
// confirms, then add_to_binder / add_to_wants write. Replaced scan_printing (a loose name search, one card per call).
import { printingsService } from '@/lib/services';
import { buildNameIndex, matchName, normalizeName, type NameIndex } from '@/lib/scan/banner/name-match';
import { defaultScanPrinting, orderPrintings, printingLine } from '@/lib/scan/banner/printing-options';
import { getFoilingName, getEditionName } from '@/lib/fab-formatters';

const MAX_CARDS = 60;
const NEAR_MISS_SCORE = -0.05;              // same cut-off as /scan: an unaccepted read worth a "not sure" answer
const INDEX_TTL_MS = 10 * 60 * 1000;
const PITCH_OF: Record<string, number> = { red: 1, yellow: 2, blue: 3 };
const COLOR_OF: Record<number, string> = { 1: 'red', 2: 'yellow', 3: 'blue' };
const FOILING_CODE: Record<string, string> = { 'non-foil': 's', 'rainbow foil': 'r', 'cold foil': 'c', 'gold foil': 'g' };

export interface IdentifyInput {
  name: string; pitchColor?: string; collectorNumber?: string; foiling?: string; quantity?: number; position?: string;
}
type Printing = any;
export interface IdentifyDeps {
  index: NameIndex;
  resolveByName(cards: Array<{ name: string; pitch?: number }>): Promise<Array<{ name: string; pitch?: number; printings: Printing[] }>>;
  resolveByCollector(collectorNumbers: string[]): Promise<Array<{ collectorNumber: string; printings: Printing[] }>>;
}
export interface IdentifiedPrinting {
  printing_id: string; card_unique_id: string; name: string; collector_number: string; set: string;
  foiling: string; edition: string; language: string; pitch: number | null; tcg_low: number | null; image_url: string | null;
}
export interface IdentifiedCard {
  position: string | null; name_read: string; status: 'confident' | 'not_sure' | 'no_match';
  matched_name: string | null; runner_up: string | null; pitch: number | null; pitch_options: string[];
  printing: IdentifiedPrinting | null;
  alternatives: Array<{ printing_id: string; collector_number: string; language: string; details: string; price: string }>;
  quantity: number; notes: string[];
}

const price = (p: Printing): number | null => (p?.tcg_low == null || !Number.isFinite(Number(p.tcg_low)) ? null : Number(p.tcg_low));
const slim = (p: Printing): IdentifiedPrinting => ({
  printing_id: p.printing_id, card_unique_id: p.card_unique_id, name: p.name, collector_number: p.collector_number, set: p.set,
  foiling: getFoilingName(p.foiling, p.is_extended_art), edition: getEditionName(p.edition), language: p.language ?? 'en',
  pitch: p.pitch ?? null, tcg_low: price(p), image_url: p.image_url ?? null,
});
const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);

export async function identifyCards(input: IdentifyInput[], deps: IdentifyDeps) {
  // collector numbers first (one batch): they can pin a printing or contradict the name
  const collectorNums = [...new Set(input.map(c => c.collectorNumber?.trim().toUpperCase()).filter((c): c is string => !!c))];
  const byCollector = new Map<string, Printing[]>();
  if (collectorNums.length) for (const r of await deps.resolveByCollector(collectorNums)) byCollector.set(r.collectorNumber.toUpperCase(), r.printings);

  // pass 1: name -> card, pitch
  const drafts = input.map(c => {
    const notes: string[] = [];
    const pitchHint = c.pitchColor ? PITCH_OF[c.pitchColor.toLowerCase()] ?? null : null;
    const cn = c.collectorNumber?.trim().toUpperCase() || null;
    const cnPrintings = cn ? byCollector.get(cn) ?? [] : [];
    if (cn && cnPrintings.length === 0) notes.push(`Collector number ${cn} doesn't exist; matched by name only.`);
    const m = matchName(deps.index, c.name ?? '', { pitch: pitchHint });
    let status: IdentifiedCard['status'] = m.accepted ? 'confident' : m.card && m.score <= NEAR_MISS_SCORE ? 'not_sure' : 'no_match';
    let matched: string | null = status === 'no_match' ? null : m.card;
    let runnerUp = m.runnerUp;
    let pitches = m.pitches;
    let pinned: Printing[] = [];
    const cnName = cnPrintings[0]?.name as string | undefined;
    if (cnName) {
      if (matched && sameName(matched, cnName)) {
        pinned = cnPrintings;
      } else if (matched) {
        status = 'not_sure'; runnerUp = cnName;
        notes.push(`The name reads as ${matched}, but collector number ${cn} is ${cnName}. Ask which it is.`);
      } else {
        status = 'not_sure'; matched = cnName; pitches = [...new Set(cnPrintings.map(p => p.pitch ?? null))];
        notes.push(`Couldn't match the name "${c.name}"; collector number ${cn} is ${cnName}.`);
      }
    }
    if (status === 'not_sure' && !notes.length) notes.push(`Not sure the name was read right. Is this ${matched}?`);

    // pitch: the name when it exists in one pitch, else the colour read off the card, else a pinned printing's
    let pitch: number | null = null, resolved = false;
    if (matched) {
      if (pitches.length === 1) { pitch = pitches[0]; resolved = true; }
      else if (pitchHint !== null && pitches.includes(pitchHint)) { pitch = pitchHint; resolved = true; }
      else if (pinned.length && pitches.includes(pinned[0].pitch ?? null)) { pitch = pinned[0].pitch ?? null; resolved = true; }
    }
    const pitchOptions = matched && !resolved ? pitches.map(p => (p === null ? 'none' : COLOR_OF[p])) : [];
    if (pitchOptions.length) notes.push(`${matched} comes in ${pitchOptions.join(', ')}. Ask which pitch, then call again with pitchColor.`);
    return { c, notes, status, matched, runnerUp, pitch, resolved, pitchOptions, pinned, cn };
  });

  // pass 2: every printing of each distinct (card, pitch), in ONE batch lookup
  const keyOf = (name: string, pitch: number | null) => `${name}|${pitch ?? ''}`;
  const wanted = new Map<string, { name: string; pitch?: number }>();
  for (const d of drafts) if (d.matched && d.resolved) {
    const k = keyOf(d.matched, d.pitch);
    if (!wanted.has(k)) wanted.set(k, d.pitch === null ? { name: d.matched } : { name: d.matched, pitch: d.pitch });
  }
  const printingsOf = new Map<string, Printing[]>();
  if (wanted.size) for (const r of await deps.resolveByName([...wanted.values()])) printingsOf.set(keyOf(r.name, r.pitch ?? null), r.printings);

  const cards: IdentifiedCard[] = drafts.map(d => {
    const all = d.matched && d.resolved ? printingsOf.get(keyOf(d.matched, d.pitch)) ?? [] : [];
    let pool = all;
    if (d.pinned.length && d.cn) {
      const onNumber = all.filter(p => String(p.collector_number).toUpperCase() === d.cn);
      if (onNumber.length) pool = onNumber;
    }
    const foil = d.c.foiling ? FOILING_CODE[d.c.foiling.toLowerCase()] : undefined;
    if (foil) {
      const withFoil = pool.filter(p => String(p.foiling).toLowerCase() === foil);
      if (withFoil.length) pool = withFoil;
      else if (pool.length) d.notes.push(`No ${d.c.foiling} printing found${d.cn && d.pinned.length ? ` for ${d.cn}` : ''}; picked the usual one.`);
    }
    const chosen = defaultScanPrinting(pool);
    const alternatives = orderPrintings(all).filter(p => p !== chosen).slice(0, 5).map(p => {
      const line = printingLine(p);
      return { printing_id: p.printing_id, collector_number: line.code, language: line.language, details: line.details.join(' · '), price: line.price };
    });
    if (d.matched && d.resolved && !all.length) d.notes.push(`No printings found for ${d.matched}.`);
    return {
      position: d.c.position ?? null, name_read: d.c.name, status: d.status, matched_name: d.matched, runner_up: d.runnerUp,
      pitch: d.resolved ? d.pitch : null, pitch_options: d.pitchOptions, printing: chosen ? slim(chosen) : null, alternatives,
      quantity: Math.max(1, Math.floor(Number(d.c.quantity) || 1)), notes: d.notes,
    };
  });
  const count = (s: IdentifiedCard['status']) => cards.filter(c => c.status === s).length;
  return { cards, summary: { confident: count('confident'), not_sure: count('not_sure'), no_match: count('no_match') } };
}

// the name index (every card name, its pitches, de/es/fr/it names) for ~10 minutes: one load serves many photos
let cachedIndex: { index: NameIndex; at: number } | null = null;
async function loadIndex(): Promise<NameIndex> {
  if (cachedIndex && Date.now() - cachedIndex.at < INDEX_TTL_MS) return cachedIndex.index;
  const res = await printingsService.getScanNameIndex();
  if (!res.success) throw new Error(res.error);
  cachedIndex = { index: buildNameIndex(res.data), at: Date.now() };
  return cachedIndex.index;
}

export function summaryText(cards: IdentifiedCard[], summary: { confident: number; not_sure: number; no_match: number }): string {
  const lines = cards.map((c, i) => {
    const where = c.position ? ` (${c.position})` : '';
    if (c.status === 'no_match') return `${i + 1}. "${c.name_read}"${where}: no match. Ask the user for the name.`;
    const p = c.printing;
    const what = p ? `${p.name} · ${p.collector_number} · ${p.foiling} · ${p.language.toUpperCase()} · ${p.tcg_low === null ? 'no price' : `$${p.tcg_low.toFixed(2)}`}` : c.matched_name;
    return `${i + 1}. ${c.status === 'confident' && !c.pitch_options.length ? '✓' : '?'} ${what}${c.quantity > 1 ? ` ×${c.quantity}` : ''}${where}${c.notes.length ? ` — ${c.notes.join(' ')}` : ''}`;
  });
  return [`Identified ${cards.length} card(s): ${summary.confident} confident, ${summary.not_sure} not sure, ${summary.no_match} no match.`,
    ...lines,
    '🎯 NEXT: show these with their images, ask about every "?" and no-match line (and any pitch question), then add the confirmed printing_ids with add_to_binder or add_to_wants. Nothing has been added yet.'].join('\n');
}

export const identifyCardsTool = {
  name: 'identify_cards',
  description: `📸 IDENTIFY THE CARDS IN A PHOTO (binder page, table spread, a single card). Read-only: adds nothing.

You read the cards; this tool matches each one to a real card and printing, using the same name matcher as the
FaB Bazaar /scan page (tolerates small misreads, accepts de/es/fr/it names, says "not sure" instead of guessing).

For EVERY card you can see, send:
  • name — the card name as printed (top banner; on full-art cards wherever the name is). Required.
  • pitchColor — the gem in the TOP-LEFT corner: red / yellow / blue. Omit if there's no gem. Matters most after the
    name: many cards come in all three pitches.
  • collectorNumber — bottom of the card, e.g. "UPR182". Only if you can actually read it.
  • foiling — non-foil / rainbow foil / cold foil / gold foil. Only if it's clearly visible.
  • quantity — copies of this exact card in the photo (default 1). position — e.g. "row 1, card 2".

Send all the cards in a photo in ONE call (up to ${MAX_CARDS}). Each result has status confident / not_sure / no_match,
the chosen printing (printing_id, collector number, foiling, language, tcg_low price, image_url) and alternatives.

Then: show the user the results with card images; ask about every not_sure, no_match and pitch_options entry; only
after the user confirms, call add_to_binder (or add_to_wants) with the printing_ids and quantities.`,

  parameters: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_CARDS,
        description: 'Every card visible in the photo, in reading order.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Card name as printed (any language).' },
            pitchColor: { type: 'string', enum: ['red', 'yellow', 'blue'], description: 'Pitch gem colour, top-left. Omit if none.' },
            collectorNumber: { type: 'string', description: 'Collector number from the bottom of the card, e.g. "UPR182". Only if legible.' },
            foiling: { type: 'string', enum: ['non-foil', 'rainbow foil', 'cold foil', 'gold foil'], description: 'Only if clearly visible.' },
            quantity: { type: 'integer', minimum: 1, description: 'Copies of this card in the photo (default 1).' },
            position: { type: 'string', description: 'Where it is in the photo, e.g. "row 2, card 3".' },
          },
          required: ['name'],
        },
      },
    },
    required: ['cards'],
  },

  async handler(params: any) {
    const cards = params?.cards;
    if (!Array.isArray(cards) || cards.length === 0) return { success: false, error: 'cards must be a non-empty array of { name, pitchColor?, collectorNumber?, foiling? }.' };
    if (cards.length > MAX_CARDS) return { success: false, error: `At most ${MAX_CARDS} cards per call; split the photo into several calls.` };
    if (cards.some((c: any) => typeof c?.name !== 'string' || !c.name.trim())) return { success: false, error: 'Every card needs a name (as read from the card).' };
    try {
      const index = await loadIndex();
      const result = await identifyCards(cards, {
        index,
        resolveByName: async (list) => {
          const r = await printingsService.bulkResolveByName(list, { frontFaceOnly: true });
          if (!r.success) throw new Error(r.error);
          return r.data;
        },
        resolveByCollector: async (nums) => {
          const r = await printingsService.bulkResolveByCollectorNumber(nums);
          if (!r.success) throw new Error(r.error);
          return r.data;
        },
      });
      return { success: true, message: summaryText(result.cards, result.summary), data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Could not identify the cards' };
    }
  },
};

export default identifyCardsTool;
