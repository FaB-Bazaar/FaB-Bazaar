#!/usr/bin/env npx tsx
/**
 * scripts/import-new-set.ts
 *
 * Ingest a NEW (spoiler-season) set from the CardVault API as PROVISIONAL
 * rows: minted internal ids, fab_cube_* = NULL (the 005 adoption pass anchors
 * them at release), lss_print_id = CardVault print UUID (idempotency).
 * English prints only (v1). Mapping logic: lib/import/cardvault-ingest.ts.
 *
 * CardVault etiquette (hard requirements, not garnish):
 *   - delta-driven: a family is fetched only if the search sweep shows a
 *     print code we have neither in the DB nor in the disk cache
 *   - payloads cached permanently in --cache-dir; steady-state runs cost
 *     ~1-2 requests (the sweep)
 *   - sequential, --delay ms + jitter between requests, identified UA
 *   - honors 429 Retry-After; aborts after 3 consecutive failures
 *   - hard --max-requests budget per run
 *
 * Usage:
 *   npx tsx scripts/import-new-set.ts --set=IAR                  # dry-run
 *   npx tsx scripts/import-new-set.ts --set=IAR --commit
 *   npx tsx scripts/import-new-set.ts --set=IAR --commit --upload-images
 *   flags: --max-requests=60 --delay=2000 --cache-dir=... --refresh
 *
 * Prereqs: sets row must exist for the set code (register + regenerate
 * constants first); POSTGRES_URL in .env.local; CLOUDFLARE_* only needed
 * with --upload-images.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pickSetPrints,
  buildProvisionalCard,
  splitFaces,
  buildFaceRows,
  naturalKeyOf,
  type LssApiFace,
  type LssApiPrint,
  type ProvisionalPrintingRow,
} from '@/lib/import/cardvault-ingest';
import { toTalisharCardId } from '@/lib/talishar/cardId';

const argv = process.argv.slice(2);
const arg = (f: string, d?: string) => argv.find((a) => a.startsWith(`${f}=`))?.split('=').slice(1).join('=') ?? d;
const SET = arg('--set')?.toUpperCase();
const COMMIT = argv.includes('--commit');
const UPLOAD_IMAGES = argv.includes('--upload-images');
const REFRESH = argv.includes('--refresh');
const MAX_REQUESTS = parseInt(arg('--max-requests', '60')!, 10);
const DELAY_MS = parseInt(arg('--delay', '2000')!, 10);
const CACHE_DIR = arg('--cache-dir', '/Users/eko/fabtcg/cardvault-api-cache')!;

const API = 'https://api.cardvault.fabtcg.com/carddb/api/v1';
const UA = 'FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)';
const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

if (!SET) {
  console.error('usage: import-new-set.ts --set=IAR [--commit] [--upload-images]');
  process.exit(1);
}
if (UPLOAD_IMAGES && !COMMIT) {
  console.error('--upload-images requires --commit');
  process.exit(1);
}

// ── polite fetch machinery ──────────────────────────────────────────────────
let requestsUsed = 0;
let consecutiveFailures = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string): Promise<any> {
  if (requestsUsed >= MAX_REQUESTS) {
    throw new Error(`request budget exhausted (${MAX_REQUESTS}) — raise --max-requests deliberately`);
  }
  if (requestsUsed > 0) await sleep(DELAY_MS + Math.floor(Math.random() * 500));
  requestsUsed++;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 429) {
    const wait = Math.min(parseInt(res.headers.get('retry-after') ?? '30', 10), 120);
    console.warn(`   429 from CardVault — backing off ${wait}s`);
    await sleep(wait * 1000);
    return politeFetch(url);
  }
  if (!res.ok) {
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      throw new Error(`3 consecutive CardVault failures (last: ${res.status} ${url}) — aborting run`);
    }
    throw Object.assign(new Error(`${res.status} ${url}`), { retryable: true });
  }
  consecutiveFailures = 0;
  return res.json();
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const setLower = SET.toLowerCase();
  const setRow = await pool.query(
    'SELECT code, name, has_first_edition FROM sets WHERE code = $1', [setLower]);
  if (!setRow.rowCount) {
    console.error(`✗ no sets row for '${setLower}' — register the set + regenerate constants first`);
    process.exit(1);
  }
  const setHasFirstEdition = !!setRow.rows[0].has_first_edition;
  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ingesting ${SET} (${setRow.rows[0].name}) | budget ${MAX_REQUESTS} requests`);
  mkdirSync(CACHE_DIR, { recursive: true });

  // 1. sweep
  const search: any[] = [];
  for (let page = 1; ; page++) {
    // Server honors large page sizes (tested: 240-row set in one page at 500);
    // the loop still follows `next`, so correctness never depends on this —
    // it only minimizes sweep requests for big sets.
    const d = await politeFetch(`${API}/advanced-search/?set_code=${SET}&page_size=250&page=${page}`);
    search.push(...d.results);
    if (!d.next) break;
  }
  const familySlugs = [...new Set(search.map((r) => r.card_id as string))];
  console.log(`sweep: ${search.length} prints across ${familySlugs.length} cards`);

  // 2. delta-driven family fetch (cache-first)
  const payloads = new Map<string, any>(); // slug -> raw API response
  let fetched = 0, fromCache = 0;
  for (const slug of familySlugs) {
    const cachePath = join(CACHE_DIR, `${slug}.json`);
    let cached: any = null;
    if (!REFRESH && existsSync(cachePath)) {
      try { cached = JSON.parse(readFileSync(cachePath, 'utf8')); } catch { cached = null; }
    }
    const cachedCodes = new Set<string>(
      cached?.results?.flatMap((r: any) => (r.card_prints ?? []).map((p: any) => p.print_id)) ?? []);
    const wantedCodes = search
      .filter((r) => r.card_id === slug)
      .flatMap((r) => [r.print_id, ...Object.values(r.languages ?? {})]) as string[];
    const stale = !cached || wantedCodes.some((c) => c && !cachedCodes.has(c));
    if (stale) {
      try {
        const fresh = await politeFetch(`${API}/card_id/${encodeURIComponent(slug)}/`);
        writeFileSync(cachePath, JSON.stringify(fresh));
        payloads.set(slug, fresh);
        fetched++;
      } catch (e: any) {
        if (!e.retryable) throw e;
        console.warn(`   skipping ${slug}: ${e.message}`);
      }
    } else {
      payloads.set(slug, cached);
      fromCache++;
    }
  }
  console.log(`payloads: ${fetched} fetched, ${fromCache} from cache (${requestsUsed}/${MAX_REQUESTS} requests used)`);

  // 3. DB preload for skip/resolve decisions
  const existing = await pool.query(
    `SELECT printing_id, lss_print_id, other_face_printing_id, set, collector_number, edition, foiling, language
       FROM printings WHERE set = $1`, [setLower]);
  const byLssPrint = new Map<string, { printing_id: string; other_face_printing_id: string | null }>(
    existing.rows.filter((r) => r.lss_print_id).map((r) => [r.lss_print_id, r]));
  const knownNaturalKeys = new Set(existing.rows.map((r) => naturalKeyOf(r)));

  const searchCardIds = new Set(familySlugs);
  const cardsInPlay: Array<{ slug: string; card: any }> = [];
  for (const [slug, payload] of payloads) {
    for (const r of payload.results ?? []) {
      if (searchCardIds.has(r.card_id) && !cardsInPlay.some((c) => c.slug === r.card_id)) {
        cardsInPlay.push({ slug: r.card_id, card: r });
      }
    }
  }
  const lssCardIds = cardsInPlay.map((c) => c.card.id);
  const cardRows = await pool.query(
    `SELECT card_unique_id, lss_card_id, talishar_card_id, fab_cube_card_id FROM cards
      WHERE lss_card_id = ANY($1) OR talishar_card_id = ANY($2)`,
    [lssCardIds, cardsInPlay.map(({ card }) => {
      const en = (card.card_prints ?? []).flatMap((p: any) => p.faces ?? []).find((f: any) => f.face_language === 'en' && f.printed_name);
      const pitch = en?.printed_pitch ? parseInt(en.printed_pitch, 10) : null;
      return en ? toTalisharCardId(en.printed_name, Number.isFinite(pitch) ? pitch : null) : '';
    }).filter(Boolean)]);
  const cardByLss = new Map(cardRows.rows.filter((r) => r.lss_card_id).map((r) => [r.lss_card_id, r.card_unique_id]));
  const cardByTal = new Map(cardRows.rows.filter((r) => r.talishar_card_id).map((r) => [r.talishar_card_id, r.card_unique_id]));
  const provisionalCardIds = new Set(cardRows.rows.filter((r) => !r.fab_cube_card_id).map((r) => r.card_unique_id));

  // 4. build the plan
  type CardRow = ReturnType<typeof buildProvisionalCard> & { talishar_card_id: string };
  const newCards: CardRow[] = [];
  // Existing PROVISIONAL cards get their derived fields refreshed (they may
  // predate the flag/stat derivation, or CardVault may have corrected text).
  // fab-cube-anchored cards are never touched — fab-cube owns their fields.
  const enrichCards: CardRow[] = [];
  const newPrintings: Array<ProvisionalPrintingRow & { is_front_face?: boolean; other_face_printing_id?: string | null }> = [];
  // Backs discovered for fronts ingested BEFORE face support: link in place.
  const retroLinks: Array<{ frontId: string; backId: string }> = [];
  let skippedLss = 0, skippedNaturalKey = 0, backRows = 0;

  // Resolve (or create/enrich) one card row; shared by front and named-back faces.
  const resolveCard = (face: LssApiFace, lssCardId: string): { id: string; via: string } => {
    const displayName = (face.printed_name ?? '').trim();
    const pitchNum = face.printed_pitch ? parseInt(face.printed_pitch, 10) : null;
    const pitch = Number.isFinite(pitchNum) ? pitchNum : null;
    const tal = toTalisharCardId(displayName, pitch);
    // Named backs share the CardVault card UUID with their front (documented
    // lss_card_id non-uniqueness), so resolution is talishar-first for them.
    let id = cardByTal.get(tal);
    let via = id ? 'talishar' : null;
    if (!id) {
      id = nanoid();
      cardByTal.set(tal, id);
      newCards.push({ ...buildProvisionalCard(face, { cardUniqueId: id, lssCardId }), talishar_card_id: tal });
      via = 'NEW';
    } else if (provisionalCardIds.has(id)) {
      enrichCards.push({ ...buildProvisionalCard(face, { cardUniqueId: id, lssCardId }), talishar_card_id: tal });
      via = `${via}+enrich`;
    }
    return { id, via: via! };
  };

  for (const { card } of cardsInPlay) {
    const prints = pickSetPrints(card.card_prints ?? [], SET, 'en') as LssApiPrint[];
    if (!prints.length) continue;
    const s0 = splitFaces(prints[0], 'en');
    const frontFace = s0.front ?? prints[0].faces?.[0];
    if (!frontFace?.printed_name?.trim()) { console.warn(`   ⚠ no EN name for ${card.card_id} — skipped`); continue; }

    // lss-first resolution applies only to the FRONT card (the shared UUID's owner).
    let frontCardId = cardByLss.get(card.id);
    let frontVia = frontCardId ? 'lss' : '';
    if (frontCardId && provisionalCardIds.has(frontCardId)) {
      const tal = toTalisharCardId(frontFace.printed_name.trim(),
        frontFace.printed_pitch ? parseInt(frontFace.printed_pitch, 10) || null : null);
      enrichCards.push({ ...buildProvisionalCard(frontFace, { cardUniqueId: frontCardId, lssCardId: card.id }), talishar_card_id: tal });
      frontVia = 'lss+enrich';
    }
    if (!frontCardId) {
      const r = resolveCard(frontFace, card.id);
      frontCardId = r.id; frontVia = r.via;
    }

    // Named back = its own card (e.g. 'Viserai, Usurper'), resolved once per family.
    const namedBackFace = prints.map((p) => splitFaces(p, 'en')).find((s) => s.namedBack)?.back ?? null;
    const backCard = namedBackFace ? resolveCard(namedBackFace, card.id) : null;

    for (const print of prints) {
      const sf = splitFaces(print, 'en');
      const frontExisting = byLssPrint.get(print.id);
      const backLssId = sf.back?.id ?? `${print.id}#back`;
      const backExisting = sf.back ? byLssPrint.get(backLssId) : undefined;

      if (frontExisting && (!sf.back || backExisting)) { skippedLss++; continue; }

      const frontId = frontExisting?.printing_id ?? nanoid();
      const backId = sf.back ? (backExisting?.printing_id ?? nanoid()) : undefined;
      const { front, back } = buildFaceRows(print, {
        frontPrintingId: frontId, frontCardId,
        backPrintingId: backId, backCardId: sf.namedBack ? backCard?.id : frontCardId,
      }, { setHasFirstEdition });

      if (!frontExisting) {
        // Whole pair presumed present when the natural key already exists
        // (fab-cube-first rows, e.g. the preview marvels' two face rows).
        if (knownNaturalKeys.has(naturalKeyOf(front))) { skippedNaturalKey++; continue; }
        knownNaturalKeys.add(naturalKeyOf(front));
        newPrintings.push(front);
      }
      if (back && !backExisting) {
        newPrintings.push(back);
        backRows++;
        if (frontExisting) retroLinks.push({ frontId, backId: backId! });
      }
    }
    const backNote = namedBackFace ? ` // ${namedBackFace.printed_name} (${backCard?.via})` : '';
    console.log(`  ${frontFace.printed_name.trim()} (${frontVia})${backNote} — ${prints.length} en prints`);
  }

  console.log(`\nplan: ${newCards.length} new cards, ${newPrintings.length} new printings ` +
    `(${backRows} back faces, ${retroLinks.length} retro-links onto existing fronts), ` +
    `${enrichCards.length} provisional cards to enrich; ` +
    `skipped ${skippedLss} already-ingested (lss), ${skippedNaturalKey} already-present (natural key)`);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
    await pool.end();
    return;
  }

  // 5. commit
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of newCards) {
      const cols = Object.keys(c);
      await client.query(
        `INSERT INTO cards (${cols.map((k) => `"${k}"`).join(',')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
        cols.map((k) => (c as any)[k]));
    }
    for (const c of enrichCards) {
      const cols = Object.keys(c).filter((k) => k !== 'card_unique_id');
      await client.query(
        `UPDATE cards SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(', ')}
          WHERE card_unique_id = $1 AND fab_cube_card_id IS NULL`,
        [c.card_unique_id, ...cols.map((k) => (c as any)[k])]);
    }
    for (const l of retroLinks) {
      await client.query(
        `UPDATE printings SET other_face_printing_id = $2
          WHERE printing_id = $1 AND other_face_printing_id IS NULL`,
        [l.frontId, l.backId]);
    }
    for (const p of newPrintings) {
      const cols = Object.keys(p);
      await client.query(
        `INSERT INTO printings (${cols.map((c) => `"${c}"`).join(',')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
        cols.map((c) => (p as any)[c]));
    }
    await client.query('COMMIT');
    console.log(`✓ committed ${newCards.length} cards + ${newPrintings.length} printings, enriched ${enrichCards.length}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 6. images (optional). RESUMABLE: sweeps the DB for any printing in this
  //    set still pointing at a non-Cloudflare image (not just rows created in
  //    this run), so a partially-failed upload pass heals on the next re-run.
  //    Existing Cloudflare images are never re-uploaded ('already exists' =
  //    success; rows already on imagedelivery are excluded by the query).
  if (UPLOAD_IMAGES) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN required for --upload-images');
    const pending = await pool.query(
      `SELECT printing_id, image_url, lss_print_code FROM printings
        WHERE set = $1 AND image_url IS NOT NULL AND image_url NOT LIKE '%imagedelivery%'`,
      [setLower]);
    console.log(`images: ${pending.rowCount} pending upload`);
    let uploaded = 0, failed = 0;
    for (const p of pending.rows) {
      try {
        const imgRes = await fetch(p.image_url);
        if (!imgRes.ok) { failed++; console.warn(`   ⚠ image fetch failed for ${p.lss_print_code ?? p.printing_id} (${imgRes.status})`); continue; }
        const form = new FormData();
        form.append('file', await imgRes.blob(), `${p.printing_id}.webp`);
        form.append('id', p.printing_id);
        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
          { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: form });
        const cfJson: any = await cfRes.json();
        const exists = (cfJson.errors ?? []).some((e: any) => e.code === 5409 || /already exists/i.test(e.message));
        if ((cfRes.ok && cfJson.success) || exists) {
          await pool.query('UPDATE printings SET image_url = $1 WHERE printing_id = $2',
            [`${CF_BASE}/${p.printing_id}/public`, p.printing_id]);
          uploaded++;
        } else {
          failed++;
          console.warn(`   ⚠ Cloudflare upload failed for ${p.lss_print_code ?? p.printing_id}: ${JSON.stringify(cfJson.errors)}`);
        }
      } catch (e: any) {
        failed++;
        console.warn(`   ⚠ upload error for ${p.lss_print_code ?? p.printing_id}: ${e?.message?.slice(0, 80)}`);
      }
      await sleep(500);
    }
    console.log(`images: ${uploaded} uploaded to Cloudflare${failed ? `, ${failed} FAILED (re-run --commit --upload-images to retry)` : ''}`);
  }

  console.log(`\nrequests used: ${requestsUsed}/${MAX_REQUESTS}. Idempotent — re-run anytime; ` +
    `only unseen prints are fetched and created.`);
  await pool.end();
})();
