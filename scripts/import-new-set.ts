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
  buildProvisionalPrinting,
  naturalKeyOf,
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
    const d = await politeFetch(`${API}/advanced-search/?set_code=${SET}&page_size=60&page=${page}`);
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
    `SELECT printing_id, lss_print_id, set, collector_number, edition, foiling, language
       FROM printings WHERE set = $1`, [setLower]);
  const knownLssPrintIds = new Set(existing.rows.map((r) => r.lss_print_id).filter(Boolean));
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
    `SELECT card_unique_id, lss_card_id, talishar_card_id FROM cards
      WHERE lss_card_id = ANY($1) OR talishar_card_id = ANY($2)`,
    [lssCardIds, cardsInPlay.map(({ card }) => {
      const en = (card.card_prints ?? []).flatMap((p: any) => p.faces ?? []).find((f: any) => f.face_language === 'en' && f.printed_name);
      const pitch = en?.printed_pitch ? parseInt(en.printed_pitch, 10) : null;
      return en ? toTalisharCardId(en.printed_name, Number.isFinite(pitch) ? pitch : null) : '';
    }).filter(Boolean)]);
  const cardByLss = new Map(cardRows.rows.filter((r) => r.lss_card_id).map((r) => [r.lss_card_id, r.card_unique_id]));
  const cardByTal = new Map(cardRows.rows.filter((r) => r.talishar_card_id).map((r) => [r.talishar_card_id, r.card_unique_id]));

  // 4. build the plan
  interface NewCard {
    card_unique_id: string; name: string; display_name: string; talishar_card_id: string;
    text: string | null; searchable_text: string | null; type_text: string | null;
    types: string[]; pitch: number | null; lss_card_id: string;
  }
  const newCards: NewCard[] = [];
  const newPrintings: ProvisionalPrintingRow[] = [];
  let skippedLss = 0, skippedNaturalKey = 0;

  for (const { card } of cardsInPlay) {
    const prints = pickSetPrints(card.card_prints ?? [], SET, 'en') as LssApiPrint[];
    if (!prints.length) continue;
    const face = prints[0].faces?.find((f) => f.face_language === 'en') ?? prints[0].faces?.[0];
    const displayName = face?.printed_name?.trim();
    if (!displayName) { console.warn(`   ⚠ no EN name for ${card.card_id} — skipped`); continue; }
    const pitchNum = face?.printed_pitch ? parseInt(face.printed_pitch, 10) : null;
    const pitch = Number.isFinite(pitchNum) ? pitchNum : null;
    const tal = toTalisharCardId(displayName, pitch);

    let cardUniqueId = cardByLss.get(card.id) ?? cardByTal.get(tal);
    let resolvedVia = cardByLss.get(card.id) ? 'lss' : cardUniqueId ? 'talishar' : null;
    if (!cardUniqueId) {
      cardUniqueId = nanoid();
      const rules = (face?.printed_rules_text ?? '').replace(/\{br\}/g, ' ').replace(/\*\*/g, '').trim();
      newCards.push({
        card_unique_id: cardUniqueId,
        name: displayName.toLowerCase(),
        display_name: displayName,
        talishar_card_id: tal,
        text: rules ? rules.toLowerCase() : null,
        searchable_text: rules ? rules.toLowerCase() : null,
        type_text: face?.printed_typebox?.toLowerCase() ?? null,
        types: (face?.printed_typebox ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
        pitch,
        lss_card_id: card.id,
      });
      resolvedVia = 'NEW';
    }

    for (const print of prints) {
      if (knownLssPrintIds.has(print.id)) { skippedLss++; continue; }
      const row = buildProvisionalPrinting(print, { printingId: nanoid(), cardUniqueId }, { setHasFirstEdition });
      if (knownNaturalKeys.has(naturalKeyOf(row))) { skippedNaturalKey++; continue; }
      knownNaturalKeys.add(naturalKeyOf(row));
      newPrintings.push(row);
    }
    console.log(`  ${displayName}${pitch != null ? ` [p${pitch}]` : ''} (${resolvedVia}) — ${prints.length} en prints`);
  }

  console.log(`\nplan: ${newCards.length} new cards, ${newPrintings.length} new printings; ` +
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
      await client.query(
        `INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id, text,
                            searchable_text, type_text, types, pitch, lss_card_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [c.card_unique_id, c.name, c.display_name, c.talishar_card_id, c.text,
         c.searchable_text, c.type_text, c.types, c.pitch, c.lss_card_id]);
    }
    for (const p of newPrintings) {
      const cols = Object.keys(p);
      await client.query(
        `INSERT INTO printings (${cols.map((c) => `"${c}"`).join(',')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`,
        cols.map((c) => (p as any)[c]));
    }
    await client.query('COMMIT');
    console.log(`✓ committed ${newCards.length} cards + ${newPrintings.length} printings`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 6. images (optional; existing images are NEVER re-uploaded — new ids only,
  //    and Cloudflare 'already exists' is treated as success)
  if (UPLOAD_IMAGES) {
    let uploaded = 0;
    for (const p of newPrintings) {
      if (!p.image_url) continue;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN required for --upload-images');
      const imgRes = await fetch(p.image_url);
      if (!imgRes.ok) { console.warn(`   ⚠ image fetch failed for ${p.lss_print_code}`); continue; }
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
        console.warn(`   ⚠ Cloudflare upload failed for ${p.lss_print_code}: ${JSON.stringify(cfJson.errors)}`);
      }
      await sleep(500);
    }
    console.log(`images: ${uploaded} uploaded to Cloudflare`);
  }

  console.log(`\nrequests used: ${requestsUsed}/${MAX_REQUESTS}. Idempotent — re-run anytime; ` +
    `only unseen prints are fetched and created.`);
  await pool.end();
})();
