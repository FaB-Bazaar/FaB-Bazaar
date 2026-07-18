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
  id?: string; // CardVault face UUID
  face_id?: string; // human face code, e.g. 'IAR106-MV', 'IAR106-MV_BACK'
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

// Typebox-token → cards boolean-flag derivation. The deck builder and search
// filter on these flags (hero pickers require is_hero; card pools exclude it),
// so provisional cards must carry them or heroes are unpickable and leak into
// card pools. Tokens come from the lowercased typebox split on non-alphanumerics.
const CLASS_FLAGS = [
  'generic', 'brute', 'guardian', 'mechanologist', 'ranger', 'runeblade',
  'assassin', 'warrior', 'ninja', 'wizard', 'merchant', 'bard', 'adjudicator',
  'illusionist', 'thief', 'shapeshifter', 'necromancer',
] as const;
const TALENT_FLAGS = [
  'chaos', 'light', 'royal', 'draconic', 'lightning', 'shadow', 'earth',
  'mystic', 'revered', 'ice', 'reviled', 'pirate', 'elemental',
] as const;
const TYPE_FLAGS = ['action', 'attack', 'instant', 'equipment', 'weapon', 'hero', 'mentor', 'token'] as const;

function toInt(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export interface ProvisionalCardIds {
  cardUniqueId: string;
  lssCardId: string;
}

/**
 * Build a full provisional `cards` row from a CardVault English face: derived
 * type/class/talent booleans + numeric stats, so spoiler cards behave in the
 * deck builder and filters, not just in name search. Legality flags are NOT
 * set — spoiler cards genuinely aren't tournament-legal until release
 * (adoption overwrites card fields with fab-cube truth then).
 */
export function buildProvisionalCard(faceIn: LssApiFace, ids: ProvisionalCardIds) {
  const displayName = (faceIn.printed_name ?? '').trim();
  const typebox = (faceIn.printed_typebox ?? '').trim();
  const typeTokens = typebox.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const rules = (faceIn.printed_rules_text ?? '').replace(/\{br\}/g, ' ').replace(/\*\*/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const pitch = toInt(faceIn.printed_pitch as any);

  const flags: Record<string, boolean> = {};
  for (const t of TYPE_FLAGS) flags[`is_${t}`] = typeTokens.includes(t);
  for (const c of CLASS_FLAGS) flags[`is_${c}`] = typeTokens.includes(c);
  for (const t of TALENT_FLAGS) flags[`has_${t}`] = typeTokens.includes(t);
  flags.is_defense_reaction = /defense reaction/i.test(typebox);

  return {
    card_unique_id: ids.cardUniqueId,
    lss_card_id: ids.lssCardId,
    name: displayName.toLowerCase(),
    display_name: displayName,
    text: rules || null,
    searchable_text: rules || null,
    type_text: typebox.toLowerCase() || null,
    types: typeTokens,
    classes: typeTokens.filter((t) => (CLASS_FLAGS as readonly string[]).includes(t)),
    talents: typeTokens.filter((t) => (TALENT_FLAGS as readonly string[]).includes(t)),
    pitch,
    cost: toInt((faceIn as any).printed_cost),
    power: toInt((faceIn as any).printed_power),
    defense: toInt((faceIn as any).printed_defense),
    intelligence: toInt((faceIn as any).printed_intellect),
    health: toInt((faceIn as any).printed_life),
    ...flags,
  };
}

// ── Double-sided prints ─────────────────────────────────────────────────────
// CardVault: one print with layout 'double-sided' and BOTH faces in faces[]
// (front first; the back's face_id carries a '_BACK' suffix and its
// printed_code is blank). Two kinds of back:
//   named back  — different printed_name (e.g. 'Viserai, Usurper'): a real
//                 game object → its own card row + linked back printing row.
//   art back    — same printed_name (e.g. Baalghor marvel): back art only →
//                 linked back printing row under the same card.
// Our canonical model mirrors fab-cube: one printing row per face, mutually
// linked via other_face_printing_id, is_front_face marking the default face.

export interface SplitFacesResult {
  front: LssApiFace | null;
  back: LssApiFace | null;
  /** true when the back is a distinct game object (different printed_name) */
  namedBack: boolean;
}

export function splitFaces(print: LssApiPrint, language: string): SplitFacesResult {
  const faces = (print.faces ?? []).filter((f) => (f.face_language ?? 'en') === language);
  const back = faces.find((f) => (f.face_id ?? '').endsWith('_BACK')) ?? null;
  const front = faces.find((f) => f !== back) ?? null;
  const namedBack = !!(back && front && back.printed_name && back.printed_name !== front.printed_name);
  return { front, back, namedBack };
}

export interface FaceRowIds {
  frontPrintingId: string;
  frontCardId: string;
  backPrintingId?: string;
  backCardId?: string;
}

/**
 * Build the printing row(s) for one physical print: always a front row; for
 * double-sided prints also a back row, mutually linked. lss identity: the
 * front row keeps the PRINT UUID (idempotency key, back-compat with rows
 * ingested before face support); the back row uses the back FACE UUID (both
 * satisfy the partial unique index).
 */
export function buildFaceRows(
  print: LssApiPrint,
  ids: FaceRowIds,
  opts: { setHasFirstEdition?: boolean } = {},
): { front: ProvisionalPrintingRow & { is_front_face: boolean; other_face_printing_id: string | null };
     back: (ProvisionalPrintingRow & { is_front_face: boolean; other_face_printing_id: string | null }) | null } {
  const { front: frontFace, back: backFace } = splitFaces(print, parseLssPrintCode(print.print_id, opts).language);
  const front = {
    ...buildProvisionalPrinting(print, { printingId: ids.frontPrintingId, cardUniqueId: ids.frontCardId }, opts),
    is_front_face: true,
    other_face_printing_id: backFace && ids.backPrintingId ? ids.backPrintingId : null,
  };
  if (frontFace?.image?.large || frontFace?.image?.normal) {
    front.image_url = frontFace.image.large ?? frontFace.image.normal ?? front.image_url;
  }
  if (!backFace || !ids.backPrintingId || !ids.backCardId) return { front, back: null };

  const back = {
    ...buildProvisionalPrinting(print, { printingId: ids.backPrintingId, cardUniqueId: ids.backCardId }, opts),
    is_front_face: false,
    other_face_printing_id: ids.frontPrintingId,
    lss_print_id: backFace.id ?? `${print.id}#back`,
    lss_print_code: backFace.face_id ?? `${print.print_id}_BACK`,
    image_url: backFace.image?.large ?? backFace.image?.normal ?? null,
  };
  return { front, back };
}

/** The 005 tier-1 adoption key — art_variations and rarity deliberately absent. */
export function naturalKeyOf(row: {
  set: string; collector_number: string; edition: string; foiling: string; language: string;
}): string {
  return [row.set, row.collector_number, row.edition, row.foiling, row.language].join('|');
}
