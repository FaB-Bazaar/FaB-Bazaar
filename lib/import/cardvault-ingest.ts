/**
 * Pure parsing/mapping logic for ingesting a NEW (spoiler-season) set from
 * CardVault (cardvault.fabtcg.com API) as PROVISIONAL rows: minted internal
 * ids, `fab_cube_* = NULL` (the 005 adoption pass anchors them when fab-cube
 * publishes the set), `lss_print_id` = CardVault's print UUID (idempotency).
 *
 * IO (fetching, DB writes, Cloudflare) lives in scripts/import-new-set.ts —
 * everything here is deterministic and unit-tested against captured payloads.
 *
 * Spoiler data is ROUGH: duplicate print entries under one print code (with
 * distinct UUIDs, sometimes blank printed_code), typo'd names that change at
 * release, prints for products that don't physically exist yet. Parsing is
 * defensive; collector numbers come from the print_id root, never from
 * printed_code (old-set codes embed rarity suffixes, spoiler ones are blank).
 */
import { FINISH_TO_FOILING, RARITY_TO_CODE, foilingFlags } from './derive-foreign-printing';

export interface LssApiFace {
  face_language?: string;
  printed_code?: string;
  printed_name?: string;
  printed_rules_text?: string;
  printed_typebox?: string;
  printed_pitch?: string | null;
  finish_type?: string;
  art_type?: string;
  image?: { small?: string; normal?: string; large?: string };
}

export interface LssApiPrint {
  id: string; // CardVault print UUID (their DB PK)
  print_id: string; // human code, e.g. 'U-ARC029-RF', 'FR_IAR159-MV'
  print_language?: string;
  rarity?: string;
  is_published?: boolean;
  print_set?: { set_code?: string };
  faces?: LssApiFace[];
}

export interface ParsedPrintCode {
  language: string;
  edition: string;
  collector: string;
  suffix: string | null;
}

/** Grammar: [LANG_][U-]<CODE>[-SUFFIX]. */
export function parseLssPrintCode(
  printId: string,
  opts: { setHasFirstEdition?: boolean } = {},
): ParsedPrintCode {
  let rest = printId;
  let language = 'en';
  const langMatch = rest.match(/^([A-Z]{2})_/);
  if (langMatch) {
    language = langMatch[1].toLowerCase();
    rest = rest.slice(3);
  }
  if (language === 'jp') language = 'ja';
  let edition = 'n';
  if (rest.startsWith('U-')) {
    edition = 'u';
    rest = rest.slice(2);
  } else if (opts.setHasFirstEdition) {
    // On a set that shipped 1st ed + Unlimited, the unprefixed code IS 1st ed.
    edition = 'f';
  }
  const dash = rest.indexOf('-');
  const collector = dash === -1 ? rest : rest.slice(0, dash);
  const suffix = dash === -1 ? null : rest.slice(dash + 1);
  return { language, edition, collector, suffix };
}

/**
 * Best-effort art_variations guess for DISPLAY during spoiler season only —
 * adoption deliberately ignores this field (proven editorially unpredictable)
 * and overwrites it with fab-cube's truth at release.
 * 'MV' → ['FA'] because every observed fab-cube marvel row (GEM/TNP/IAR) is {FA}.
 */
export function guessArtVariations(suffix: string | null): string[] {
  if (suffix === 'MV') return ['FA'];
  if (suffix === 'EA') return ['EA'];
  return [];
}

/**
 * Filter a card's prints to one set + language and dedupe rough spoiler data:
 * one print per print_id, preferring published entries with a non-blank
 * printed_code on their matching face.
 */
export function pickSetPrints(prints: LssApiPrint[], setCode: string, language: string): LssApiPrint[] {
  const face = (p: LssApiPrint) =>
    p.faces?.find((f) => f.face_language === language) ?? p.faces?.[0];
  const quality = (p: LssApiPrint) =>
    (p.is_published ? 2 : 0) + (face(p)?.printed_code ? 1 : 0);

  const byCode = new Map<string, LssApiPrint>();
  for (const p of prints) {
    if (p.print_set?.set_code !== setCode) continue;
    const lang = parseLssPrintCode(p.print_id).language;
    if (lang !== language) continue;
    const prev = byCode.get(p.print_id);
    if (!prev || quality(p) > quality(prev)) byCode.set(p.print_id, p);
  }
  return [...byCode.values()];
}

export interface ProvisionalPrintingRow {
  printing_id: string;
  card_unique_id: string;
  set: string;
  collector_number: string;
  edition: string;
  foiling: string;
  rarity: string;
  language: string;
  art_variations: string[];
  is_first_edition: boolean;
  is_unlimited: boolean;
  is_normal_edition: boolean;
  is_extended_art: boolean;
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;
  is_common: boolean;
  is_rare: boolean;
  is_super_rare: boolean;
  is_majestic: boolean;
  is_legendary: boolean;
  is_fabled: boolean;
  is_promo: boolean;
  fab_cube_printing_id: null;
  lss_print_id: string;
  lss_print_code: string;
  image_url: string | null;
}

export function buildProvisionalPrinting(
  print: LssApiPrint,
  ids: { printingId: string; cardUniqueId: string },
  opts: { setHasFirstEdition?: boolean } = {},
): ProvisionalPrintingRow {
  const parsed = parseLssPrintCode(print.print_id, opts);
  const face =
    print.faces?.find((f) => f.face_language === parsed.language) ?? print.faces?.[0] ?? {};
  const foiling = FINISH_TO_FOILING[face.finish_type ?? ''];
  if (!foiling) {
    throw new Error(`cardvault-ingest: unknown finish_type "${face.finish_type}" for ${print.print_id}`);
  }
  const rarity = RARITY_TO_CODE[print.rarity ?? ''];
  if (!rarity) {
    throw new Error(`cardvault-ingest: unknown rarity "${print.rarity}" for ${print.print_id}`);
  }
  return {
    printing_id: ids.printingId,
    card_unique_id: ids.cardUniqueId,
    set: (print.print_set?.set_code ?? '').toLowerCase(),
    collector_number: parsed.collector,
    edition: parsed.edition,
    foiling,
    rarity,
    language: parsed.language,
    art_variations: guessArtVariations(parsed.suffix),
    is_first_edition: parsed.edition === 'f',
    is_unlimited: parsed.edition === 'u',
    is_normal_edition: parsed.edition === 'n',
    is_extended_art: face.art_type === 'extended-art',
    ...foilingFlags(foiling),
    is_common: rarity === 'c',
    is_rare: rarity === 'r',
    is_super_rare: rarity === 's',
    is_majestic: rarity === 'm',
    is_legendary: rarity === 'l',
    is_fabled: rarity === 'f',
    is_promo: rarity === 'p',
    fab_cube_printing_id: null,
    lss_print_id: print.id,
    lss_print_code: print.print_id,
    image_url: face.image?.large ?? face.image?.normal ?? null,
  };
}

/** The 005 tier-1 adoption key — art_variations and rarity deliberately absent. */
export function naturalKeyOf(row: {
  set: string; collector_number: string; edition: string; foiling: string; language: string;
}): string {
  return [row.set, row.collector_number, row.edition, row.foiling, row.language].join('|');
}
