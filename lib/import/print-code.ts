// lib/import/print-code.ts
// "Print codes" identify one exact printing in a single string — the CSV
// import contract for partner tools (Nanza). Two grammars are accepted:
//   - ours = the deterministic image id (lib/images/deterministic-image-id.ts),
//     e.g. ARC159-RF-1E, JA_HNT260-AA, DYN000-CF-EA-AA-EA
//   - CardVault's print_id, e.g. U-ARC029-RF, FR_IAR106-MV_BACK
// The resolver first matches the code EXACTLY against each printing's image id
// and stored lss_print_code (see PostgresPrintingsService.resolvePrintCodes);
// this module covers the fallback — parse the code into attributes and pick
// among the printings that share its collector number. Pure: no DB access.
import { parseCsvLine } from '@/lib/utils/csv-line';

export interface ParsedPrintCodeAttrs {
  language: string;
  collector: string;
  /** null = the code names no foiling */
  foiling: string | null;
  /** null = the code names no edition */
  edition: string | null;
  artVariations: string[];
  back: boolean;
  /** CardVault 'MV' (marvel): full art, foiling not encoded in the code */
  marvel: boolean;
  unknownTokens: string[];
}

const FOILING_TOKENS: Record<string, string> = { RF: 'r', CF: 'c', GF: 'g' };
const EDITION_TOKENS: Record<string, string> = { '1E': 'f', UL: 'u', AL: 'a' };
const ART_TOKENS = new Set(['EA', 'AA', 'AB', 'AT', 'FA', 'HS']);

export function parsePrintCode(code: string): ParsedPrintCodeAttrs {
  let rest = code.trim().toUpperCase();

  let language = 'en';
  const lang = rest.match(/^([A-Z]{2})_/);
  if (lang) {
    language = lang[1] === 'JP' ? 'ja' : lang[1].toLowerCase();
    rest = rest.slice(3);
  }

  let back = false;
  if (rest.endsWith('_BACK')) {
    back = true;
    rest = rest.slice(0, -'_BACK'.length);
  }

  let edition: string | null = null;
  if (rest.startsWith('U-')) {
    edition = 'u';
    rest = rest.slice(2);
  }

  const [collector, ...tokens] = rest.split('-');
  let foiling: string | null = null;
  let marvel = false;
  const arts = new Set<string>();
  const unknownTokens: string[] = [];

  for (const t of tokens) {
    if (!t) continue;
    if (FOILING_TOKENS[t]) foiling = FOILING_TOKENS[t];
    else if (EDITION_TOKENS[t]) edition = EDITION_TOKENS[t];
    else if (ART_TOKENS.has(t)) arts.add(t);
    else if (t === 'MV') { marvel = true; arts.add('FA'); }
    else unknownTokens.push(t);
  }

  return {
    language,
    collector,
    foiling,
    edition,
    artVariations: [...arts].sort(),
    back,
    marvel,
    unknownTokens,
  };
}

/**
 * The print code a printing is known by: its Cloudflare image id
 * (`…/<id>/public`) or, for the rows still hosted by CardVault, the image's
 * file name (`…/large/IAR187-RF.webp`). printing_id-keyed images return the
 * printing_id, which is still a unique code for that row.
 */
export function printCodeFromImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const cf = imageUrl.match(/\/([^/]+)\/public$/);
  if (cf) return cf[1];
  const file = imageUrl.match(/\/([^/]+)\.(?:webp|png|jpe?g)$/i);
  return file ? file[1] : null;
}

export interface PrintCodeCandidate {
  printing_id: string;
  name: string;
  collector_number: string;
  language: string;
  foiling: string;
  edition: string;
  art_variations: string[] | null;
  is_extended_art: boolean;
  is_front_face: boolean | null;
}

export type PrintCodePick =
  | { status: 'ok'; printingId: string }
  | { status: 'ambiguous'; printingIds: string[] }
  | { status: 'not_found' };

// A code without an edition token: ours means Normal, CardVault's means 1st
// edition on a set that shipped 1st + Unlimited — so take the first edition
// that exists, in this order.
const EDITION_PREFERENCE = ['n', 'f', 'u', 'a'];

function candidateArts(c: PrintCodeCandidate): Set<string> {
  const arts = new Set((c.art_variations ?? []).filter(Boolean));
  if (c.is_extended_art) arts.add('EA');
  return arts;
}

export function pickPrintingForCode(
  code: ParsedPrintCodeAttrs,
  candidates: PrintCodeCandidate[],
): PrintCodePick {
  let pool = candidates.filter(c =>
    c.collector_number.toUpperCase() === code.collector &&
    (c.language ?? 'en').toLowerCase() === code.language &&
    (c.is_front_face !== false) === !code.back,
  );
  if (pool.length === 0) return { status: 'not_found' };

  // A token we can't read might be the very thing that tells two printings
  // apart — only trust the code when there's nothing to tell apart.
  if (code.unknownTokens.length > 0) {
    return pool.length === 1
      ? { status: 'ok', printingId: pool[0].printing_id }
      : { status: 'ambiguous', printingIds: pool.map(c => c.printing_id) };
  }

  // Marvel codes don't encode foiling; every other code without a foil token is non-foil.
  if (code.foiling) pool = pool.filter(c => c.foiling === code.foiling);
  else if (!code.marvel) pool = pool.filter(c => c.foiling === 's');

  if (code.edition) {
    pool = pool.filter(c => c.edition === code.edition);
  } else {
    const edition = EDITION_PREFERENCE.find(e => pool.some(c => c.edition === e));
    pool = pool.filter(c => c.edition === edition);
  }

  const wanted = code.artVariations;
  pool = pool.filter(c => {
    const arts = candidateArts(c);
    return wanted.every(a => arts.has(a));
  });
  if (pool.length === 0) return { status: 'not_found' };

  // Prefer the printing with the fewest art variations the code didn't name.
  const extra = (c: PrintCodeCandidate) => candidateArts(c).size - wanted.length;
  const fewest = Math.min(...pool.map(extra));
  pool = pool.filter(c => extra(c) === fewest);

  return pool.length === 1
    ? { status: 'ok', printingId: pool[0].printing_id }
    : { status: 'ambiguous', printingIds: pool.map(c => c.printing_id) };
}

// ── CSV ────────────────────────────────────────────────────────────────────

// resolvePrintCodes sends each code twice (as typed + uppercased) into four
// IN lists — ~8 bind parameters per row, and Postgres caps a query at 65,535.
// Raising this past ~8,000 needs the lookup chunked first.
export const PRINT_CODE_CSV_MAX_ROWS = 5000;
// Real codes are well under 40 characters (JA_DYN000-CF-EA-AA-EA).
const PRINT_CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;

const clip = (v: string | undefined) => {
  const t = v ?? '';
  return t.length > 20 ? `${t.slice(0, 20)}…` : t;
};
const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
export type CsvCondition = (typeof CONDITIONS)[number];

export interface PrintCodeCsvRow {
  /** 1-based line number in the file (header = 1) */
  line: number;
  printCode: string;
  name: string;
  quantity: number;
  condition: CsvCondition;
  forTrade: boolean;
  wantsQuantity: number;
}

export interface PrintCodeCsvParseResult {
  rows: PrintCodeCsvRow[];
  errors: string[];
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', '']);

export function parsePrintCodeCsv(csvText: string): PrintCodeCsvParseResult {
  const lines = csvText.replace(/^﻿/, '').split(/\r?\n/);
  const headers = parseCsvLine(lines[0] ?? '').map(h => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);

  if (col('print_code') === -1) {
    return { rows: [], errors: ['Missing required column: print_code.'] };
  }

  const dataLines = lines.slice(1).filter(l => l.trim() !== '');
  if (dataLines.length > PRINT_CODE_CSV_MAX_ROWS) {
    return {
      rows: [],
      errors: [`The file has ${dataLines.length} rows; the limit is ${PRINT_CODE_CSV_MAX_ROWS.toLocaleString('en-US')} per upload. Split it into smaller files.`],
    };
  }

  const rows: PrintCodeCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const lineNo = i + 1;
    const cols = parseCsvLine(lines[i]);
    const get = (name: string) => (col(name) === -1 ? undefined : (cols[col(name)] ?? '').trim());

    const printCode = get('print_code') ?? '';
    if (!printCode) {
      errors.push(`Row ${lineNo}: missing print_code, skipped.`);
      continue;
    }
    if (!PRINT_CODE_RE.test(printCode)) {
      errors.push(`Row ${lineNo}: print_code isn't a valid code (letters, digits, _ and - only, up to 64 characters), skipped.`);
      continue;
    }

    const qty = (name: string, absentDefault: number): number | null => {
      const raw = get(name);
      if (raw === undefined) return absentDefault;
      if (raw === '') return 0;
      return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
    };
    const quantity = qty('quantity', 1);
    const wantsQuantity = qty('wants_quantity', 0);
    if (quantity === null || wantsQuantity === null) {
      errors.push(`Row ${lineNo} (${printCode}): quantity must be a whole number, skipped.`);
      continue;
    }

    const rawCondition = (get('condition') ?? '').toUpperCase();
    const condition = (rawCondition || 'NM') as CsvCondition;
    if (!CONDITIONS.includes(condition)) {
      errors.push(`Row ${lineNo} (${printCode}): condition "${clip(get('condition'))}" isn't one of ${CONDITIONS.join('/')}, skipped.`);
      continue;
    }

    const rawTrade = (get('for_trade') ?? '').toLowerCase();
    if (!TRUE_VALUES.has(rawTrade) && !FALSE_VALUES.has(rawTrade)) {
      errors.push(`Row ${lineNo} (${printCode}): for_trade "${clip(get('for_trade'))}" isn't true/false, skipped.`);
      continue;
    }

    if (quantity === 0 && wantsQuantity === 0) continue;

    rows.push({
      line: lineNo,
      printCode,
      name: get('name') ?? '',
      quantity,
      condition,
      forTrade: TRUE_VALUES.has(rawTrade),
      wantsQuantity,
    });
  }

  return { rows, errors };
}

// ── Catalog ────────────────────────────────────────────────────────────────

/** One row of the public print-code catalog partners join their data on. */
export interface PrintCodeCatalogRow {
  print_code: string;
  printing_id: string;
  name: string;
  pitch: number | null;
  set: string;
  collector_number: string;
  language: string;
  foiling: string;
  edition: string;
  art_variations: string[];
  rarity: string;
}

const CATALOG_COLUMNS = [
  'print_code', 'name', 'pitch', 'set', 'collector_number', 'language',
  'foiling', 'edition', 'art_variations', 'rarity', 'printing_id',
] as const;

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function formatPrintCodeCatalogCsv(rows: PrintCodeCatalogRow[]): string {
  const lines = [CATALOG_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(CATALOG_COLUMNS.map(c => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      return csvField(Array.isArray(v) ? v.join(' ') : String(v));
    }).join(','));
  }
  return lines.join('\n') + '\n';
}
