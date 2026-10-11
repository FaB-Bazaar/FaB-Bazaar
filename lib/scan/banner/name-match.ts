// lib/scan/banner/name-match.ts — OCR text of a card's name banner -> card name.
//
// Score = edit errors per letter of the name (against the best-fitting window of the text, so junk at the banner
// ends is tolerated) MINUS a bonus for how much of the text the name explains, plus penalties. Lower is better;
// at or below ACCEPT_SCORE the match is confident enough to accept without asking the user. Every rule below came
// from a real misread in the scanner experiments (photos + labels: ~/Documents/FaB-Bazaar-Notes/scan-corpus/binder):
//   coverage  — plain edit distance picked "Hiss" for "es fempestits KISS AN" (Tempestuous Kiss)
//   short     — "Site : 3" was accepted as "Sit!": names of <= 5 letters must match exactly and fill the line
//   translated— de/es/fr/it names are a second vocabulary of everyday words (fr "Or" = Gold inside "SOR,",
//               "Rossée" = Thump inside "cROSSES"): nearly exact (<= 1 error / 20 letters) and covering the line
//   pitch     — a SOFT penalty: the pips misread equipment as pitched, and a hard filter threw the right name away
//   accept    — besides the score: <= 1 error per 5 letters (was 4: "k 3 Lightning" -> Arc Lightning) ("MATTERS" -> Shatter, a phone read -> "Bam Bam") and the name
//               explaining >= half the line (rules text "Flt SEDATE Se" -> Sedate, an everyday word)
// A trigram prefilter keeps only the names sharing the most letter triples with the text before the edit-distance
// pass (brute force over ~11k names cost ~250 ms per read).

export const ACCEPT_SCORE = -0.2;
const COVERAGE_WEIGHT = 0.5;
const PITCH_PENALTY = 0.15;
const REJECT_PENALTY = 0.5;
const SHORT_NAME_MAX = 5;
const EXACT_NAME_MAX = 6;            // names this short must match every letter: "Dangle" -> Mangle slipped through
const SHORT_NAME_MIN_COVERAGE = 0.8;
const TRANSLATED_MAX_ERR = 0.05;
const TRANSLATED_MIN_COVERAGE = 0.6;
const PREFILTER_KEEP = 80;
const ACCEPT_MAX_ERR = 0.2;           // <= 1 error per 5 letters: type line "k 3 lightning" -> Arc Lightning was 3/13
const TRANSLATED_MIN_LENGTH = 4;     // fr "Or" = Gold matched "[or ——"
const ACCEPT_MIN_COVERAGE = 0.5;

export interface NameSource { name: string; pitches: Array<number | null>; translations?: string[] }
export interface NameMatch { card: string; score: number; accepted: boolean; runnerUp: string | null; pitches: Array<number | null> }

interface Candidate { text: string; card: number; translated: boolean }
export interface NameIndex {
  cards: NameSource[];
  candidates: Candidate[];
  trigrams: Map<string, number[]>;   // trigram -> candidate ids
  tiny: number[];                    // candidates too short to have a trigram
}

/** Lowercase, accents stripped (Kāṣāya -> kasaya), only a-z0-9 and single spaces. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function trigramsOf(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function buildNameIndex(sources: NameSource[]): NameIndex {
  const candidates: Candidate[] = [];
  sources.forEach((src, card) => {
    candidates.push({ text: normalizeName(src.name), card, translated: false });
    for (const t of src.translations ?? []) {
      const n = normalizeName(t);
      if (n && n !== candidates[candidates.length - 1].text) candidates.push({ text: n, card, translated: true });
    }
  });
  const trigrams = new Map<string, number[]>(); const tiny: number[] = [];
  candidates.forEach((c, id) => {
    const grams = trigramsOf(c.text);
    if (grams.size === 0) tiny.push(id);
    for (const g of grams) { let list = trigrams.get(g); if (!list) trigrams.set(g, list = []); list.push(id); }
  });
  return { cards: sources, candidates, trigrams, tiny };
}

function levenshtein(a: string, b: string, row: Uint16Array): number {
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Smallest edit distance between `name` and any window of `text` about the name's length. */
function bestWindowDistance(text: string, name: string, row: Uint16Array): number {
  let d = Infinity;
  const L = name.length;
  for (let s = 0; s <= Math.max(0, text.length - L); s++)
    for (const len of [L - 1, L, L + 1]) if (len > 0) d = Math.min(d, levenshtein(text.slice(s, s + len), name, row));
  return d;
}

function scoreCandidate(index: NameIndex, c: Candidate, text: string, pitch: number | null | undefined, row: Uint16Array): { score: number; err: number; coverage: number } {
  const L = c.text.length;
  const d = bestWindowDistance(text, c.text, row);
  const err = d / Math.max(L, 1);
  const coverage = Math.min(1, L / Math.max(text.length, 1));
  let score = err - COVERAGE_WEIGHT * coverage;
  if (pitch != null && !index.cards[c.card].pitches.includes(pitch)) score += PITCH_PENALTY;
  if (L <= SHORT_NAME_MAX && (d > 0 || coverage < SHORT_NAME_MIN_COVERAGE)) score += REJECT_PENALTY;
  if (L <= EXACT_NAME_MAX && d > 0) score += REJECT_PENALTY;
  if (c.translated && (err > TRANSLATED_MAX_ERR || coverage < TRANSLATED_MIN_COVERAGE || L < TRANSLATED_MIN_LENGTH)) score += REJECT_PENALTY;
  return { score, err, coverage };
}

function prefilter(index: NameIndex, text: string): number[] {
  const hits = new Map<number, number>();
  for (const g of trigramsOf(text)) for (const id of index.trigrams.get(g) ?? []) hits.set(id, (hits.get(id) ?? 0) + 1);
  const ranked = [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, PREFILTER_KEEP).map(([id]) => id);
  return ranked.concat(index.tiny);
}

/** Best card for one or more OCR reads of the same banner. `pitch` (from the pip icon) is a soft hint only. */
export function matchName(index: NameIndex, text: string | string[], opts: { pitch?: number | null } = {}): NameMatch {
  const best = new Map<number, { score: number; err: number; coverage: number }>();   // card -> best over all reads/spellings
  const row = new Uint16Array(256);
  for (const raw of Array.isArray(text) ? text : [text]) {
    const t = normalizeName(raw).slice(0, 200);
    if (t.length < 2) continue;
    for (const id of prefilter(index, t)) {
      const c = index.candidates[id];
      const s = scoreCandidate(index, c, t, opts.pitch, row);
      if (s.score < (best.get(c.card)?.score ?? Infinity)) best.set(c.card, s);
    }
  }
  const ranked = [...best.entries()].sort((a, b) => a[1].score - b[1].score);
  if (ranked.length === 0) return { card: '', score: Infinity, accepted: false, runnerUp: null, pitches: [] };
  const [[card, { score, err, coverage }]] = ranked;
  const accepted = score <= ACCEPT_SCORE && err <= ACCEPT_MAX_ERR && coverage >= ACCEPT_MIN_COVERAGE;
  return { card: index.cards[card].name, score, accepted, runnerUp: ranked[1] ? index.cards[ranked[1][0]].name : null, pitches: index.cards[card].pitches };
}

export interface NameSuggestion { name: string; pitches: Array<number | null> }
const SUGGEST_FUZZY_MAX_SCORE = 0.2;   // a typo'd query still offers its closest card, but not wild guesses

/**
 * Autocomplete for typing a card's name (/scan "Not this card?", "Add a card we missed"): names STARTING with the
 * query, then names with a WORD starting with it, then names containing it — translated names count, the English
 * name is what's suggested. With room left, the fuzzy matcher's best card covers typos ("teklo poundr").
 */
export function suggestNames(index: NameIndex, query: string, limit = 12): NameSuggestion[] {   // 12: "teklo" alone has 16 names
  const q = normalizeName(query);
  if (q.length < 2) return [];
  // card -> best rank: 0 prefix, 1 word prefix, 2 anywhere; a TRANSLATED name ranks just after English names of the
  // same kind ("massac" is Massacre, not Hungering Slaughterbeast via French "Massacreur affamé")
  const rank = new Map<number, number>();
  for (const c of index.candidates) {
    let r = c.text.startsWith(q) ? 0 : ` ${c.text}`.includes(` ${q}`) ? 1 : c.text.includes(q) ? 2 : -1;
    if (r < 0) continue;
    if (c.translated) r += 0.5;
    if (r < (rank.get(c.card) ?? 9)) rank.set(c.card, r);
  }
  const cards = [...rank.entries()]
    .sort((a, b) => a[1] - b[1] || index.cards[a[0]].name.localeCompare(index.cards[b[0]].name))
    .slice(0, limit).map(([card]) => card);
  if (cards.length < limit && q.length >= 4) {
    const m = matchName(index, query);
    const card = index.cards.findIndex(c => c.name === m.card);
    if (card >= 0 && m.score <= SUGGEST_FUZZY_MAX_SCORE && !cards.includes(card)) cards.push(card);
  }
  return cards.map(card => ({ name: index.cards[card].name, pitches: index.cards[card].pitches }));
}
