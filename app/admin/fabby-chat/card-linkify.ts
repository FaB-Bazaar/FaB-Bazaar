// Card-name linkification for Fabby's markdown answers.
//
// Every card Fabby discusses came from a search_printings result this session,
// and those results are already in the browser (name + representative
// printing_id + image). We build a name→card index from them and wrap any
// occurrence of a known card name in the rendered answer with a hover span
// wired to the rail — no model cooperation, no hallucinated printing IDs.
import type { CardPreview } from './quick-actions';

export interface IndexedCard {
  /** 1=red, 2=yellow, 3=blue — used to disambiguate multi-pitch names. */
  pitch?: number;
  preview: CardPreview;
}
export type CardNameIndex = Map<string, IndexedCard[]>;

// Curly/back apostrophes → straight, length-preserving so match offsets taken
// on the normalized string still index correctly into the original text.
const QUOTE_RE = /[‘’`]/g;

export function normalizeCardName(s: string): string {
  return s.replace(QUOTE_RE, "'").toLowerCase().trim();
}

export function buildCardNameIndex(
  cards: Array<{ name?: string; pitch?: number; preview: CardPreview }>,
): CardNameIndex {
  const index: CardNameIndex = new Map();
  for (const c of cards) {
    const name = c.name ?? c.preview?.name;
    if (!name || !c.preview) continue;
    const key = normalizeCardName(name);
    if (!key) continue;
    const list = index.get(key) ?? [];
    const pid = c.preview.printingId;
    if (!pid || !list.some((e) => e.preview.printingId === pid)) {
      list.push({ pitch: c.pitch, preview: c.preview });
    }
    index.set(key, list);
  }
  return index;
}

/**
 * Choose which printing of a (possibly multi-pitch) card name to preview.
 * A name like "Zero to Sixty" has red/yellow/blue variants; for a hover
 * preview we default to the lowest pitch (red), or honor a nearby color hint.
 */
export function pickPreview(entries: IndexedCard[], colorHint?: number): CardPreview {
  if (colorHint != null) {
    const hit = entries.find((e) => e.pitch === colorHint);
    if (hit) return hit.preview;
  }
  return [...entries].sort((a, b) => (a.pitch ?? 99) - (b.pitch ?? 99))[0].preview;
}

export interface LinkSegment {
  value: string;
  preview?: CardPreview;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a run of text into plain + card-linked segments. Matches are
 * case-insensitive, apostrophe-normalized, word-boundary aware (so "Heist"
 * does not match inside "Heister"), and longest-name-first (so "Command and
 * Conquer" wins over "Command"). Rejoining the segment `value`s reproduces the
 * original text exactly.
 */
export function splitTextByCardNames(text: string, index: CardNameIndex): LinkSegment[] {
  if (!text || index.size === 0) return [{ value: text }];

  const names = [...index.keys()].sort((a, b) => b.length - a.length);
  const alternation = names.map(escapeRegExp).join('|');
  // Boundaries exclude alphanumerics only, so names ending/adjacent to spaces,
  // punctuation, table pipes, or markdown emphasis still match.
  const re = new RegExp(`(?<![A-Za-z0-9])(${alternation})(?![A-Za-z0-9])`, 'gi');

  const normalized = text.replace(QUOTE_RE, "'");
  const segments: LinkSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > last) segments.push({ value: text.slice(last, start) });
    const entries = index.get(normalizeCardName(m[0]));
    segments.push({
      value: text.slice(start, end),
      preview: entries ? pickPreview(entries) : undefined,
    });
    last = end;
  }
  if (last < text.length) segments.push({ value: text.slice(last) });
  return segments.length ? segments : [{ value: text }];
}

// Elements whose text should never be linkified (code snippets, existing links).
const SKIP_TAGS = new Set(['code', 'pre', 'a', 'cardref']);

/**
 * rehype plugin: walk the markdown tree and replace card-name occurrences in
 * text nodes with `<cardref data-pid="...">` elements — uniformly across
 * paragraphs, table cells, bold/emphasis, and lists. react-markdown then maps
 * `cardref` to the hover component. Returns a transformer `(tree) => void`.
 */
export function rehypeLinkifyCards(index: CardNameIndex) {
  const transform = (node: any): void => {
    if (!node || !Array.isArray(node.children)) return;
    const out: any[] = [];
    for (const child of node.children) {
      if (child?.type === 'text') {
        const segs = splitTextByCardNames(child.value, index);
        if (segs.length === 1 && !segs[0].preview) {
          out.push(child);
          continue;
        }
        for (const s of segs) {
          if (s.preview) {
            out.push({
              type: 'element',
              tagName: 'cardref',
              properties: { dataPid: s.preview.printingId ?? '' },
              children: [{ type: 'text', value: s.value }],
            });
          } else {
            out.push({ type: 'text', value: s.value });
          }
        }
      } else {
        if (!(child?.type === 'element' && SKIP_TAGS.has(child.tagName))) {
          transform(child);
        }
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: any) => transform(tree);
}
