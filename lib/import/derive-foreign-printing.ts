/**
 * Derive a printings-row's attributes directly from an LSS CardVault print +
 * face, for foreign-language-EXCLUSIVE sets (e.g. History Pack 2 `2HP`,
 * `RAP`) that have NO English printing in the same set to mirror.
 *
 * The card itself still exists in English in some OTHER set (e.g. Scour via
 * Everfest), which is how the card_unique_id is resolved upstream — but the
 * physical printing's own attributes (foiling, rarity, edition, art) have to
 * come from the LSS print, not from an English counterpart.
 *
 * Throws on an unmapped rarity/finish rather than guessing — a wrong code is
 * worse than a loud failure during import.
 */

export interface LssPrintLike {
  print_language: string;
  rarity: string;
  print_set: { set_code: string };
}

export interface LssFaceLike {
  printed_code: string;
  finish_type: string;
  art_type: string;
}

export interface DerivedPrinting {
  set: string;
  collector_number: string;
  language: string;
  foiling: string;
  rarity: string;
  edition: string;
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
}

// LSS finish_type -> our foiling code (matches import-i18n.ts FINISH_TO_FOILING).
const FINISH_TO_FOILING: Record<string, string> = {
  regular: 's',
  'rainbow-foil': 'r',
  'cold-foil': 'c',
  'gold-foil': 'g',
};

// LSS rarity string -> our single-letter rarity code (see RARITY_OPTIONS).
const RARITY_TO_CODE: Record<string, string> = {
  common: 'c',
  rare: 'r',
  'super-rare': 's',
  majestic: 'm',
  legendary: 'l',
  fabled: 'f',
  marvel: 'v',
  promo: 'p',
  token: 't',
  basic: 'b',
};

// The three foil-flag booleans for a foiling code. A printing's foil flags must
// come from ITS OWN foiling, never from a mirrored English row (e.g. a cold-foil
// foreign card whose English counterpart is standard).
export function foilingFlags(foiling: string): {
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;
} {
  return {
    is_normal_foil: foiling === 's',
    is_rainbow_foil: foiling === 'r',
    is_cold_foil: foiling === 'c',
  };
}

export function deriveForeignPrinting(print: LssPrintLike, face: LssFaceLike): DerivedPrinting {
  const foiling = FINISH_TO_FOILING[face.finish_type];
  if (!foiling) {
    throw new Error(`deriveForeignPrinting: unknown finish_type "${face.finish_type}" for ${face.printed_code}`);
  }
  const rarity = RARITY_TO_CODE[print.rarity];
  if (!rarity) {
    throw new Error(`deriveForeignPrinting: unknown rarity "${print.rarity}" for ${face.printed_code}`);
  }

  return {
    set: print.print_set.set_code.toLowerCase(),
    collector_number: face.printed_code,
    language: print.print_language,
    foiling,
    rarity,
    // Supplemental products (History Pack, RAP) carry no first/alpha edition.
    edition: 'n',
    is_first_edition: false,
    is_unlimited: false,
    is_normal_edition: true,
    is_extended_art: face.art_type === 'extended-art',
    ...foilingFlags(foiling),
    is_common: rarity === 'c',
    is_rare: rarity === 'r',
    is_super_rare: rarity === 's',
    is_majestic: rarity === 'm',
    is_legendary: rarity === 'l',
    is_fabled: rarity === 'f',
    is_promo: rarity === 'p',
  };
}
