#!/usr/bin/env npx tsx
/**
 * scripts/import-i18n.ts
 *
 * Imports translations + physical printings for every card present in
 * /Users/eko/fabtcg/fabtcgcards.json (typically ~all legendary + fabled
 * cards across all 6 languages: en, fr, de, it, es, ja).
 *
 * Per card:
 *   1. Resolve our `card_unique_id` by trying each LSS print's `printed_code`
 *      against printings.collector_number until exactly one card matches.
 *   2. For each target language present in the card's faces:
 *      - Upsert one `card_translations` row from any face in that language.
 *      - For each print in that language, create a new `printings` row
 *        mirroring the English counterpart's variant attributes, then upload
 *        the image from LSS S3 → Cloudflare with the new printing_id as the
 *        image ID.
 *
 * Idempotent across runs:
 *   - card_translations UPSERTs on (card_unique_id, language).
 *   - printings skips by (card_unique_id, set, collector_number, language).
 *   - Cloudflare 5409 ("already exists") treated as success.
 *
 * Non-destructive: never UPDATEs existing English rows, never DELETEs.
 *
 * Usage:
 *   npx tsx scripts/import-i18n.ts                              # all cards
 *   npx tsx scripts/import-i18n.ts --dry-run                    # plan only
 *   npx tsx scripts/import-i18n.ts --max-cards=10               # first 10 cards
 *   npx tsx scripts/import-i18n.ts --card-uuid=366d51cf-...     # scope to one
 *   npx tsx scripts/import-i18n.ts --lang=fr,de                 # subset of languages
 *
 * Required env (in .env.local):
 *   POSTGRES_URL
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Pool } from "pg";
import { nanoid } from "nanoid";
import { readFileSync } from "node:fs";
import { deriveForeignPrinting, foilingFlags } from "@/lib/import/derive-foreign-printing";
import { linkForeignFaces } from "@/lib/import/link-foreign-faces";
import { selectPrintsForImport } from "@/lib/import/select-prints";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
// Foreign-language-exclusive sets (e.g. 2HP, RAP) have no English printing to
// mirror. With this flag, a print with no English counterpart is built from the
// LSS print itself (deriveForeignPrinting) instead of being counted "unmatched".
// Off by default, so the standard English-anchored runs are byte-for-byte the same.
const ALLOW_FOREIGN_ONLY = argv.includes("--allow-foreign-only");
// Restrict printing creation to a single set (e.g. --set=2hp). Without this, a
// per-card run processes the card's prints across EVERY set it appears in. The
// translation upsert stays set-agnostic (a card's translated name is the same
// regardless of set).
const SET_ARG = argv.find((a) => a.startsWith("--set="));
const SET_FILTER = SET_ARG ? SET_ARG.replace("--set=", "").toLowerCase() : null;
const LANG_ARG = argv.find((a) => a.startsWith("--lang="));
const CARD_UUID_ARG = argv.find((a) => a.startsWith("--card-uuid="));
const MAX_CARDS_ARG = argv.find((a) => a.startsWith("--max-cards="));

const DEFAULT_LANGUAGES = ["en", "fr", "de", "it", "es", "ja"];
const TARGET_LANGUAGES = LANG_ARG
  ? LANG_ARG.replace("--lang=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_LANGUAGES;
const SCOPE_CARD_UUID = CARD_UUID_ARG?.replace("--card-uuid=", "");
const MAX_CARDS = MAX_CARDS_ARG ? parseInt(MAX_CARDS_ARG.replace("--max-cards=", ""), 10) : undefined;

const FABTCG_JSON = "/Users/eko/fabtcg/fabtcgcards.json";
const CF_BASE = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LssFace {
  id?: string; // CardVault face UUID (stored as lss_print_id on face rows)
  face_id?: string; // CardVault face code, e.g. FR_IAR106-MV_BACK
  face_language: string;
  finish_type: string;
  art_type: string;
  printed_code: string;
  printed_name: string;
  printed_rules_text: string;
  printed_typebox: string;
  printed_traitbox: string;
  printed_flavor_text: string;
  image: { small: string; normal: string; large: string };
}

interface LssPrint {
  print_id: string;
  print_language: string;
  rarity: string;
  layout: string;
  print_set: { set_code: string };
  faces: LssFace[];
}

interface LssResult {
  id: string;
  cores: Array<{ name: string }>;
  card_prints: LssPrint[];
}

// ---------------------------------------------------------------------------
// Cloudflare upload
// ---------------------------------------------------------------------------

async function uploadToCloudflare(imageUrl: string, imageId: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`LSS S3 fetch failed (${imgRes.status}): ${imageUrl}`);
  const imgBlob = await imgRes.blob();

  const form = new FormData();
  form.append("file", imgBlob, `${imageId}.webp`);
  form.append("id", imageId);

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: form },
  );
  const cfJson = await cfRes.json();
  if (cfRes.ok && cfJson.success) return;

  const errors = (cfJson.errors ?? []) as Array<{ code: number; message: string }>;
  if (errors.some((e) => e.code === 5409 || /already exists/i.test(e.message))) return;
  throw new Error(`Cloudflare upload failed: ${JSON.stringify(cfJson)}`);
}

const FINISH_TO_FOILING: Record<string, string> = {
  regular: "s",
  "rainbow-foil": "r",
  "cold-foil": "c",
  "gold-foil": "g",
};

function parseTraits(traitbox: string): string[] | null {
  const t = traitbox.trim();
  return t ? t.split(/\s+/) : null;
}

// ---------------------------------------------------------------------------
// Per-language work for a single card
// ---------------------------------------------------------------------------

interface LangStats {
  translations: number;
  printings: number;
  skipped: number;
  unmatched: number;
  cf_uploads: number;
}

async function importFaceLanguage(
  pool: Pool,
  card: LssResult,
  faceIdx: number,
  cardUniqueId: string,
  lang: string,
  deps: ImportDeps = { upload: uploadToCloudflare },
): Promise<LangStats> {
  const stats: LangStats = { translations: 0, printings: 0, skipped: 0, unmatched: 0, cf_uploads: 0 };

  // Translation source: face[faceIdx] of any print in this language
  const face = card.card_prints
    .filter((p) => p.print_language === lang)
    .map((p) => p.faces[faceIdx])
    .find((f): f is LssFace => !!f && f.face_language === lang);
  if (!face) return stats; // No face at this index in this language — silent skip

  const translationRow = {
    card_unique_id: cardUniqueId,
    language: lang,
    name: face.printed_name,
    display_name: face.printed_name,
    text: face.printed_rules_text || null,
    type_text: face.printed_typebox || null,
    traits: parseTraits(face.printed_traitbox),
    flavor_text: face.printed_flavor_text || null,
    source: "fabtcg-feed",
    source_card_id: card.id,
  };

  const prints = selectPrintsForImport(card.card_prints, lang, SET_FILTER);

  type PrintingPlan = {
    new_printing_id: string;
    lss_print_id: string | null;
    lss_print_code: string | null;
    set: string;
    collector_number: string;
    edition: string;
    foiling: string;
    rarity: string;
    is_extended_art: boolean;
    art_variations: string[] | null;
    is_first_edition: boolean;
    is_unlimited: boolean;
    is_normal_edition: boolean;
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
    image_url: string;
    image_source_url: string;
  };

  const plans: PrintingPlan[] = [];

  // Same-run twin guard: CardVault lists attribute-identical duplicate prints
  // (e.g. APS013 vs APS013-CC — same finish, same art, same scan). The DB
  // existence check below can't catch those because plans are inserted after
  // the loop; without this set, both twins landed as duplicate rows (the May
  // 2026 twin cohort).
  const plannedKeys = new Set<string>();

  for (const p of prints) {
    const f = p.faces[faceIdx];
    const collector = f?.printed_code;
    if (!collector) {
      stats.unmatched++;
      continue;
    }
    const setCode = p.print_set.set_code.toLowerCase();
    // A printing is identified by its FOILING too — a card can have a standard
    // AND a cold-foil/rainbow printing at the same collector+language (e.g. the
    // History Pack hero cold foils). Keying without foiling skipped/duplicated them.
    const lssFoiling = FINISH_TO_FOILING[f.finish_type] ?? "s";
    // Art comes from the FACE, not the mirrored English row — two prints can
    // share a foiling and differ only by art (rainbow regular vs rainbow EA).
    const faceIsEA = f.art_type === "extended-art";

    const plannedKey = `${setCode}|${collector}|${lang}|${lssFoiling}|${faceIsEA}`;
    if (plannedKeys.has(plannedKey)) {
      stats.skipped++;
      continue;
    }

    const existing = await pool.query<{ printing_id: string }>(
      `SELECT printing_id FROM printings
        WHERE card_unique_id = $1 AND set = $2 AND collector_number = $3 AND language = $4 AND foiling = $5
        LIMIT 1`,
      [cardUniqueId, setCode, collector, lang, lssFoiling],
    );
    if (existing.rows.length > 0) {
      stats.skipped++;
      continue;
    }

    const enMatch = await pool.query<{
      printing_id: string;
      edition: string;
      foiling: string;
      rarity: string;
      is_extended_art: boolean;
      art_variations: string[] | null;
      is_first_edition: boolean;
      is_unlimited: boolean;
      is_normal_edition: boolean;
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
    }>(
      `SELECT printing_id, edition, foiling, rarity, is_extended_art, art_variations,
              is_first_edition, is_unlimited, is_normal_edition,
              is_normal_foil, is_rainbow_foil, is_cold_foil,
              is_common, is_rare, is_super_rare, is_majestic, is_legendary, is_fabled, is_promo
         FROM printings
        WHERE card_unique_id = $1 AND set = $2 AND collector_number = $3 AND language = 'en'
        ORDER BY (foiling = $4) DESC, (is_extended_art = $5) DESC
        LIMIT 1`,
      [cardUniqueId, setCode, collector, lssFoiling, faceIsEA],
    );

    if (enMatch.rows.length === 0) {
      // No same-set English to mirror. For foreign-exclusive sets, derive the
      // printing's attributes from the LSS print itself; otherwise it's unmatched.
      if (ALLOW_FOREIGN_ONLY) {
        const d = deriveForeignPrinting(p, f);
        const newId = nanoid();
        plannedKeys.add(plannedKey);
        plans.push({
          new_printing_id: newId,
          lss_print_id: f.id ?? null,
          lss_print_code: f.face_id ?? null,
          set: d.set,
          collector_number: d.collector_number,
          edition: d.edition,
          foiling: d.foiling,
          rarity: d.rarity,
          is_extended_art: d.is_extended_art,
          art_variations: null,
          is_first_edition: d.is_first_edition,
          is_unlimited: d.is_unlimited,
          is_normal_edition: d.is_normal_edition,
          is_normal_foil: d.is_normal_foil,
          is_rainbow_foil: d.is_rainbow_foil,
          is_cold_foil: d.is_cold_foil,
          is_common: d.is_common,
          is_rare: d.is_rare,
          is_super_rare: d.is_super_rare,
          is_majestic: d.is_majestic,
          is_legendary: d.is_legendary,
          is_fabled: d.is_fabled,
          is_promo: d.is_promo,
          image_url: `${CF_BASE}/${newId}/public`,
          image_source_url: f.image.normal,
        });
        continue;
      }
      stats.unmatched++;
      continue;
    }

    const en = enMatch.rows[0];
    const newId = nanoid();
    plannedKeys.add(plannedKey);
    plans.push({
      new_printing_id: newId,
      lss_print_id: f.id ?? null,
      lss_print_code: f.face_id ?? null,
      set: setCode,
      collector_number: collector,
      edition: en.edition,
      // Foiling + its flags come from the FOREIGN print itself, not the English
      // row — a cold-foil foreign printing must not inherit the English standard.
      foiling: lssFoiling,
      rarity: en.rarity,
      // Art comes from the FACE (like foiling): two prints can share a foiling
      // and differ only by art. The EN mirror is RANKED by art match above, so
      // art_variations usually comes from the right variant; is_extended_art
      // stays face-truthful even when English lacks the matching variant.
      is_extended_art: faceIsEA,
      art_variations: faceIsEA === en.is_extended_art ? en.art_variations : (faceIsEA ? ["EA"] : []),
      is_first_edition: en.is_first_edition,
      is_unlimited: en.is_unlimited,
      is_normal_edition: en.is_normal_edition,
      ...foilingFlags(lssFoiling),
      is_common: en.is_common,
      is_rare: en.is_rare,
      is_super_rare: en.is_super_rare,
      is_majestic: en.is_majestic,
      is_legendary: en.is_legendary,
      is_fabled: en.is_fabled,
      is_promo: en.is_promo,
      image_url: `${CF_BASE}/${newId}/public`,
      image_source_url: f.image.normal,
    });
  }

  if (DRY_RUN) {
    if (plans.length > 0 || face) stats.translations = 1;
    stats.printings = plans.length;
    return stats;
  }

  for (const plan of plans) {
    await deps.upload(plan.image_source_url, plan.new_printing_id);
    stats.cf_uploads++;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO card_translations (
         card_unique_id, language, name, display_name, text, type_text, traits, flavor_text,
         source, source_card_id, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       ON CONFLICT (card_unique_id, language) DO UPDATE SET
         name = EXCLUDED.name,
         display_name = EXCLUDED.display_name,
         text = EXCLUDED.text,
         type_text = EXCLUDED.type_text,
         traits = EXCLUDED.traits,
         flavor_text = EXCLUDED.flavor_text,
         source = EXCLUDED.source,
         source_card_id = EXCLUDED.source_card_id,
         updated_at = now()`,
      [
        translationRow.card_unique_id,
        translationRow.language,
        translationRow.name,
        translationRow.display_name,
        translationRow.text,
        translationRow.type_text,
        translationRow.traits,
        translationRow.flavor_text,
        translationRow.source,
        translationRow.source_card_id,
      ],
    );
    stats.translations = 1;

    // Also promote LSS UUID to cards.lss_card_id (idempotent — only sets if NULL).
    // This lets future imports / diffs match by UUID without re-resolving by name.
    await client.query(
      `UPDATE cards SET lss_card_id = $2 WHERE card_unique_id = $1 AND lss_card_id IS NULL`,
      [cardUniqueId, card.id],
    );

    for (const plan of plans) {
      await client.query(
        `INSERT INTO printings (
           printing_id, card_unique_id, set, edition, foiling, rarity, collector_number,
           language, image_url,
           is_extended_art, art_variations,
           is_first_edition, is_unlimited, is_normal_edition,
           is_normal_foil, is_rainbow_foil, is_cold_foil,
           is_common, is_rare, is_super_rare, is_majestic, is_legendary, is_fabled, is_promo,
           lss_print_id, lss_print_code,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26, now(), now())`,
        [
          plan.new_printing_id,
          cardUniqueId,
          plan.set,
          plan.edition,
          plan.foiling,
          plan.rarity,
          plan.collector_number,
          lang,
          plan.image_url,
          plan.is_extended_art,
          plan.art_variations,
          plan.is_first_edition,
          plan.is_unlimited,
          plan.is_normal_edition,
          plan.is_normal_foil,
          plan.is_rainbow_foil,
          plan.is_cold_foil,
          plan.is_common,
          plan.is_rare,
          plan.is_super_rare,
          plan.is_majestic,
          plan.is_legendary,
          plan.is_fabled,
          plan.is_promo,
          plan.lss_print_id,
          plan.lss_print_code,
        ],
      );
      stats.printings++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Per-card driver
// ---------------------------------------------------------------------------

async function resolveCardUniqueId(pool: Pool, card: LssResult): Promise<string | null> {
  // Resolve the PRIMARY face's card (face[0]). English display name lives at
  // the end of cores[].name after '---' (e.g. "levia-redeemed---Levia, Redeemed"
  // → "Levia, Redeemed"). Used to disambiguate DFCs where two faces share a
  // collector_number.
  const englishName = card.cores[0]?.name?.split('---').pop()?.trim().toLowerCase();

  for (const p of card.card_prints) {
    const code = p.faces[0]?.printed_code;
    if (!code) continue;
    const r = await pool.query<{ card_unique_id: string; display_name: string }>(
      `SELECT DISTINCT c.card_unique_id, c.display_name
         FROM cards c JOIN printings p USING (card_unique_id)
        WHERE p.collector_number = $1
        LIMIT 10`,
      [code],
    );
    if (r.rows.length === 1) return r.rows[0].card_unique_id;
    if (r.rows.length > 1 && englishName) {
      const match = r.rows.find((row) => row.display_name.toLowerCase() === englishName);
      if (match) return match.card_unique_id;
    }
  }
  return null;
}

/**
 * For DFC back-faces (faceIdx > 0), resolve the card_unique_id by matching
 * the face's printed_code + printed_name against cards.display_name. The two
 * faces share the same collector_number, so the name is what disambiguates.
 */
async function resolveFaceCardUniqueId(
  pool: Pool,
  card: LssResult,
  faceIdx: number,
): Promise<string | null> {
  for (const p of card.card_prints.filter((p) => p.print_language === 'en')) {
    const face = p.faces[faceIdx];
    if (!face) continue;
    const r = await pool.query<{ card_unique_id: string }>(
      `SELECT DISTINCT c.card_unique_id
         FROM cards c JOIN printings p USING (card_unique_id)
        WHERE p.collector_number = $1
          AND LOWER(c.display_name) = LOWER($2)
        LIMIT 2`,
      [face.printed_code, face.printed_name],
    );
    if (r.rows.length === 1) return r.rows[0].card_unique_id;
  }
  return null;
}

export interface ImportDeps {
  upload: (sourceUrl: string, imageId: string) => Promise<void>;
}

export async function importCard(
  pool: Pool,
  card: LssResult,
  deps: ImportDeps = { upload: uploadToCloudflare },
): Promise<{ stats: LangStats; cardUniqueId: string | null; name: string; faceCount: number }> {
  const name = card.cores[0]?.name?.split("---").pop() ?? "<unknown>";
  const stats: LangStats = { translations: 0, printings: 0, skipped: 0, unmatched: 0, cf_uploads: 0 };

  // Resolve primary face (face[0]) the existing way
  const primaryCardId = await resolveCardUniqueId(pool, card);
  if (!primaryCardId) return { stats, cardUniqueId: null, name, faceCount: 0 };

  // Build face_idx → card_unique_id map. faceCount comes from any English
  // print (LSS keeps face count consistent across language prints of the
  // same card).
  const enPrint = card.card_prints.find((p) => p.print_language === 'en');
  const faceCount = enPrint?.faces.length ?? 1;
  const faceMap = new Map<number, string>();
  faceMap.set(0, primaryCardId);
  for (let i = 1; i < faceCount; i++) {
    const id = await resolveFaceCardUniqueId(pool, card, i);
    if (id) faceMap.set(i, id);
  }

  // Iterate every (face, language) pair
  for (const [faceIdx, cardUniqueId] of Array.from(faceMap.entries())) {
    for (const lang of TARGET_LANGUAGES) {
      const s = await importFaceLanguage(pool, card, faceIdx, cardUniqueId, lang, deps);
      stats.translations += s.translations;
      stats.printings += s.printings;
      stats.skipped += s.skipped;
      stats.unmatched += s.unmatched;
      stats.cf_uploads += s.cf_uploads;
    }
  }
  return { stats, cardUniqueId: primaryCardId, name, faceCount };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  console.log(`Loading ${FABTCG_JSON}…`);
  const raw = JSON.parse(readFileSync(FABTCG_JSON, "utf8")) as Array<{ results: LssResult[] }>;
  let cards: LssResult[] = raw.flatMap((page) => page.results ?? []);
  console.log(`  ${cards.length} cards in feed`);

  if (SCOPE_CARD_UUID) {
    cards = cards.filter((c) => c.id === SCOPE_CARD_UUID);
    console.log(`  Filtered to --card-uuid=${SCOPE_CARD_UUID} → ${cards.length} card(s)`);
  }
  if (MAX_CARDS != null) {
    cards = cards.slice(0, MAX_CARDS);
    console.log(`  Limited to --max-cards=${MAX_CARDS} → ${cards.length} card(s)`);
  }

  console.log(`\nTarget languages: ${TARGET_LANGUAGES.join(", ")}${DRY_RUN ? "  (dry run)" : ""}`);
  console.log("=".repeat(70));

  const totals: LangStats = { translations: 0, printings: 0, skipped: 0, unmatched: 0, cf_uploads: 0 };
  const unresolved: string[] = [];
  const failed: Array<{ name: string; err: string }> = [];
  const t0 = Date.now();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const tag = `[${i + 1}/${cards.length}]`;
    try {
      const { stats, cardUniqueId, name } = await importCard(pool, card);
      if (!cardUniqueId) {
        unresolved.push(name);
        console.log(`${tag} ${name.padEnd(40)} UNRESOLVED (no matching card in DB)`);
        continue;
      }
      const parts = [
        stats.translations > 0 ? `+${stats.translations}t` : null,
        stats.printings > 0 ? `+${stats.printings}p` : null,
        stats.cf_uploads > 0 ? `↑${stats.cf_uploads}img` : null,
        stats.skipped > 0 ? `=${stats.skipped}` : null,
        stats.unmatched > 0 ? `?${stats.unmatched}` : null,
      ].filter(Boolean).join(" ");
      console.log(`${tag} ${name.padEnd(40)} ${parts || "(no change)"}`);
      totals.translations += stats.translations;
      totals.printings += stats.printings;
      totals.skipped += stats.skipped;
      totals.unmatched += stats.unmatched;
      totals.cf_uploads += stats.cf_uploads;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ name: card.cores[0]?.name ?? card.id, err: msg });
      console.error(`${tag} ${card.cores[0]?.name ?? card.id}: ERROR — ${msg}`);
    }
  }

  // DFC face linkage can't be finalized per-insert (the partner face's row
  // may not exist yet), so mirror the English rows' linkage in one pass at
  // the end. Idempotent — also heals rows from earlier runs.
  let faceLink = { facesFlagged: 0, pairsLinked: 0 };
  if (!DRY_RUN) {
    faceLink = await linkForeignFaces(pool);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(70));
  console.log(`Done in ${elapsed}s${DRY_RUN ? " (dry run — no DB writes, no CF uploads)" : ""}`);
  console.log(`  DFC faces flagged:         ${faceLink.facesFlagged}`);
  console.log(`  DFC face pairs linked:     ${faceLink.pairsLinked}`);
  console.log(`  Cards processed:           ${cards.length}`);
  console.log(`  Cards resolved in DB:      ${cards.length - unresolved.length - failed.length}`);
  console.log(`  Cards unresolved:          ${unresolved.length}`);
  console.log(`  Cards failed:              ${failed.length}`);
  console.log(`  card_translations upserts: ${totals.translations}`);
  console.log(`  printings inserts:         ${totals.printings}`);
  console.log(`  printings skipped (exist): ${totals.skipped}`);
  console.log(`  printings unmatched:       ${totals.unmatched}`);
  console.log(`  Cloudflare uploads:        ${totals.cf_uploads}`);

  if (unresolved.length > 0) {
    console.log(`\nUnresolved cards (no matching collector_number in DB):`);
    for (const n of unresolved.slice(0, 20)) console.log(`  - ${n}`);
    if (unresolved.length > 20) console.log(`  ... and ${unresolved.length - 20} more`);
  }
  if (failed.length > 0) {
    console.log(`\nFailed cards:`);
    for (const f of failed.slice(0, 10)) console.log(`  - ${f.name}: ${f.err}`);
    if (failed.length > 10) console.log(`  ... and ${failed.length - 10} more`);
  }

  await pool.end();
}

// Run only when executed directly — the module is also imported by tests.
const entry = process.argv[1];
if (entry && (entry.endsWith("import-i18n.ts") || entry.endsWith("import-i18n.js"))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
