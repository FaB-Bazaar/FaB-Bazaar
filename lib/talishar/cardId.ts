// Port of Talishar's GetCardIdentifier (zzCardCodeGenerator.php:80-101).
// Talishar derives its in-game card identifier from (display_name, pitch);
// the derivation is deterministic, so we mirror it here instead of mapping.
//
// Validated against:
//   - 4721 entries in Talishar's GeneratedCardName dictionary (100% match
//     after accounting for state suffixes Talishar appends downstream — see
//     normalizeTalisharId below).
//   - 318 real (cardId, displayName, pitch) triples from FaB Bazaar game
//     results — 100% match. See __fixtures__/real-cards.jsonl.
//
// Source-of-truth file in Talishar:
//   /Users/eko/talishar/zzCardCodeGenerator.php  function GetCardIdentifier
// If Talishar changes the algorithm, the fixture-based test in cardId.test.ts
// will catch the regression.

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ID_CHARS = /[^a-z0-9_]/g;
const DOUBLE_UNDERSCORE = /__/g;
const SET_PREFIX = /^[A-Z]{3}\d{3}_/;

export function toTalisharCardId(name: string, pitch: number | null | undefined): string {
  // The one explicit special case hardcoded in Talishar's generator.
  if (name === "Goldfin Harpoon") return "goldfin_harpoon_yellow";

  let id = name.toLowerCase();

  // DFC card names like "Comet Storm // Shock". The literal "//" is replaced
  // with a single "_" before spaces, so the surrounding spaces then collapse
  // through the underscore-pair pass into the canonical double-underscore.
  id = id.replaceAll("//", "_");

  // Explicit diacritic map (matches PHP exactly, plus ð/þ which PHP's iconv
  // TRANSLIT handles but JS NFD does not decompose).
  id = id
    .replaceAll("ā", "a")
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "s")
    .replaceAll("ṣ", "s")
    .replaceAll("ð", "d")
    .replaceAll("þ", "th");

  // Approximation of PHP's iconv('UTF-8', 'US-ASCII//TRANSLIT'): split
  // remaining accented letters into base + combining mark, then drop the marks.
  id = id.normalize("NFD").replace(COMBINING_MARKS, "");

  id = id.replaceAll(" ", "_");
  id = id.replaceAll("-", "_");

  // Strip apostrophes, commas, colons, exclamation points, etc.
  id = id.replace(NON_ID_CHARS, "");

  // PHP preg_replace replaces non-overlapping pairs once. Three underscores
  // collapse to two, four collapse to two, etc. This is intentional — see the
  // DFC double-underscore behavior above.
  id = id.replace(DOUBLE_UNDERSCORE, "_");

  // Talishar always appends the pitch word verbatim — even when the slug
  // already ends in it (e.g. "Backup Protocol: RED" pitch 1 → backup_protocol_red_red).
  const suffix = pitch === 1 ? "_red" : pitch === 2 ? "_yellow" : pitch === 3 ? "_blue" : "";
  return id + suffix;
}

// Talishar appends additional suffixes/prefixes to a cardId depending on the
// runtime state of the card (equipped equipment, perched ally, reversed) or
// alternate-art set prefix. None of these change the underlying card; strip
// them before doing a `talishar_card_id` lookup.
//
// Order matters: strip the set prefix first (since it doesn't overlap with
// the suffixes), then peel suffixes from the right.
export function normalizeTalisharId(id: string): string {
  let s = id.replace(SET_PREFIX, "");
  // Note: only the _equip suffix is stripped — the underlying pitch suffix is
  // part of the canonical talishar_card_id and must be preserved. Evo
  // equipment is pitched (e.g. "evo_beta_base_chest_blue"), so Talishar's
  // "evo_beta_base_chest_blue_equip" should resolve to that pitched id, not
  // to a bare "evo_beta_base_chest".
  if (s.endsWith("_equip")) s = s.slice(0, -6);
  if (s.endsWith("_ally")) s = s.slice(0, -5);
  if (s.endsWith("_r")) s = s.slice(0, -2);
  return s;
}
